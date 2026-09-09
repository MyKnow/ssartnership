import { readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
export function assertRestoreDatabaseIdentity(expected, actual) {
  if (typeof expected !== 'string' || !/^[1-9][0-9]{0,19}$/u.test(expected) || expected !== actual) throw Error('PRODUCTION_RESTORE_IDENTITY_MISMATCH');
}

export async function restoreProductionBackup(backup, expectedDatabaseSystemId) {
const check=v=>{if(!v)throw Error('ORIGINAL_RESTORE_CHECK_FAILED');};
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:64*1024**2,timeout:120000,stdio:['ignore','pipe','pipe']});
const id=v=>'"'+v.replaceAll('"','""')+'"';
const name=`ssartnership-production-recovery-${randomUUID()}`;
const sql=query=>run('docker',['exec',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','/tmp','-U','supabase_admin','-d','postgres','-c',query]).trim();
async function files(root,prefix='') {
  const entries=[];
  for(const name of (await readdir(path.join(root,prefix))).sort()) {
    const relative=path.join(prefix,name),full=path.join(root,relative),s=await lstat(full);check(!s.isSymbolicLink());
    if(s.isDirectory())entries.push(...await files(root,relative));
    else{check(s.isFile());entries.push({path:relative,bytes:s.size,sha256:createHash('sha256').update(await readFile(full)).digest('hex')});}
  }
  return entries;
}
let stage='preflight',started=false;
try{
 process.umask(0o077);check(process.platform==='linux'&&process.getuid()===0&&/^\/srv\/backups\/ssartnership-production\/from-mac-[a-f0-9-]{36}$/.test(backup));
 const stat=await lstat(backup);check(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===0&&(stat.mode&0o077)===0);
 const manifest=JSON.parse(await readFile(`${backup}/manifest.json`,'utf8'));
 check(manifest.version===1&&manifest.kind==='production-cold-snapshot'&&manifest.databaseCleanlyStopped===true&&manifest.applicationWritesQuiesced===true);
 assertRestoreDatabaseIdentity(expectedDatabaseSystemId,manifest.databaseSystemId);
 check(/^sha256:[a-f0-9]{64}$/.test(manifest.databaseImage));
 check(!(await readdir(backup)).some(n=>n==='data'||n==='storage'));
 stage='extract';
 for(const [file,prefix,gzip] of [['database.tar.gz','data/',true],['storage.tar','storage/',false]]){
   const args=['--list',...(gzip?['--gzip']:[]),'--file',`${backup}/${file}`];
   const names=run('tar',args).trim().split('\n');
   const kinds=run('tar',[...args,'--verbose']).trim().split('\n');
   check(names.length===kinds.length&&names.every(n=>n.startsWith(prefix)&&!n.split('/').includes('..'))&&kinds.every(n=>/^[-d]/.test(n)));
 }
 run('tar',['--extract','--gzip','--numeric-owner','--file',`${backup}/database.tar.gz`,'--directory',backup]);
 run('tar',['--extract','--xattrs','--acls','--numeric-owner','--file',`${backup}/storage.tar`,'--directory',backup]);
 stage='storage-compare';
 run('tar',['--compare','--xattrs','--acls','--file',`${backup}/storage.tar`,'--directory',backup]);
 check(JSON.stringify(await files(`${backup}/storage`))===JSON.stringify(manifest.storage));
 stage='isolated-database-start';
 run('docker',['run','-d','--name',name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','100:101','--memory','1g','--cpus','1','--pids-limit','128','--tmpfs','/tmp:mode=1777,size=64m','--mount',`type=bind,src=${backup}/data,dst=/data`,'--entrypoint','postgres',manifest.databaseImage,'-D','/data','-c','listen_addresses=','-c','unix_socket_directories=/tmp','-c','archive_mode=off','-c','archive_command=','-c','shared_preload_libraries=','-c','log_statement=none','-c','log_min_error_statement=panic','-c','log_error_verbosity=terse','-c','log_parameter_max_length_on_error=0']);started=true;
 const deadline=Date.now()+30000;
 for(;;){try{sql('SELECT 1');break;}catch{check(Date.now()<deadline);await new Promise(r=>setTimeout(r,500));}}
 const current=JSON.parse(run('docker',['inspect',name]))[0];
 check(current.HostConfig.NetworkMode==='none'&&current.Mounts.filter(m=>m.Type==='bind').length===1&&current.Mounts.find(m=>m.Destination==='/data')?.Source===`${backup}/data`);
 assertRestoreDatabaseIdentity(expectedDatabaseSystemId,sql('SELECT system_identifier::text FROM pg_control_system();'));
 stage='all-table-comparison';let rows=0;
 for(const table of manifest.tables){
   const actual=JSON.parse(sql(`SELECT json_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(j,E'\\n' ORDER BY j COLLATE "C"),''),'UTF8')),'hex')) FROM (SELECT to_jsonb(t)::text j FROM ${id(table.schema)}.${id(table.name)} t) q`));
   check(actual.rows===table.rows&&actual.sha256===table.sha256);rows+=actual.rows;
 }
 const actualTables=Number(sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'"));check(actualTables===manifest.tables.length);
 const proof={version:1,restored:true,verifiedAt:new Date().toISOString(),source:'encrypted-mac-roundtrip',project:'ssartnership-production-data',databaseImage:manifest.databaseImage,databaseSystemId:expectedDatabaseSystemId,receiptManifestDatabaseIdentityMatch:true,tables:manifest.tables.length,rows,storageFiles:manifest.storage.length,storageBytes:manifest.storage.reduce((n,f)=>n+f.bytes,0),allRowsMatch:true,allFileHashesMatch:true,storageMetadataTarCompare:true,noSourceDataMount:true,network:'none',continuousPitr:false,publicCutover:false};
 await writeFile(`${backup}/restore-proof.json`,JSON.stringify(proof,null,2),{mode:0o600,flag:'wx'});console.log(JSON.stringify(proof));
}catch{console.error(JSON.stringify({error:'ORIGINAL_RESTORE_FAILED',stage,container:name}));process.exitCode=1;}
finally{if(started){try{run('docker',['stop','--time','30',name]);run('docker',['rm',name]);}catch{console.error('{"error":"ORIGINAL_RESTORE_CONTAINER_CLEANUP_FAILED"}');process.exitCode=1;}}}
}

if (process.argv[1] && (process.argv[1] === '-' || import.meta.url === new URL(process.argv[1], 'file:').href)) {
  await restoreProductionBackup(process.argv[2], process.argv[3]);
}
