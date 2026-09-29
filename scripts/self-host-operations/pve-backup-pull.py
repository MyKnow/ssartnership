#!/usr/bin/python3
"""Pull encrypted Production snapshots through the restricted backup SSH boundary."""
import datetime, fcntl, hashlib, json, os, pathlib, re, shutil, stat, subprocess, tempfile, time
ROOT = pathlib.Path('/mnt/ssartnership-backups')
SECRETS = pathlib.Path('/etc/myknow/secrets/ssartnership-backup')
UUID = re.compile(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}')
HASH = re.compile(r'[a-f0-9]{64}')
SSH = ['/usr/bin/ssh','-F','/dev/null','-S','none','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','GlobalKnownHostsFile=/dev/null','-o',f'UserKnownHostsFile={SECRETS}/known_hosts','-o','HostKeyAlias=192.168.1.191','-o','ForwardAgent=no','-o','ClearAllForwardings=yes','-o','ConnectTimeout=10','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3','-i',str(SECRETS/'ssh-key'),'ssartnership-backup@100.121.111.50']

def validate_receipt(v):
    if not isinstance(v,dict) or set(v) != {'version','id','sha256','recipient','bytes','createdAt','databaseSystemId','continuousPitr'}: raise ValueError()
    if type(v['version']) is not int or v['version'] != 1 or not UUID.fullmatch(str(v['id'])) or not HASH.fullmatch(str(v['sha256'])): raise ValueError()
    if type(v['bytes']) is not int or not 1024 <= v['bytes'] <= 20*1024**3 or v['continuousPitr'] is not False: raise ValueError()
    if not re.fullmatch(r'age1[023456789acdefghjklmnpqrstuvwxyz]{58}',str(v['recipient'])) or not re.fullmatch(r'[1-9][0-9]{0,19}',str(v['databaseSystemId'])): raise ValueError()
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z',str(v['createdAt'])): raise ValueError()
    parsed=datetime.datetime.fromisoformat(v['createdAt'].replace('Z','+00:00'))
    if parsed.timestamp()>time.time()+300: raise ValueError()
    return v

def private_path(p, directory=False):
    s=p.lstat()
    if p.resolve()!=p or s.st_uid!=0 or s.st_mode & 0o077 or (not stat.S_ISDIR(s.st_mode) if directory else not stat.S_ISREG(s.st_mode)): raise ValueError()

def digest(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def save_json(p,v):
    fd,tmp=tempfile.mkstemp(prefix='.state-',dir=p.parent)
    try:
        with os.fdopen(fd,'w') as f: json.dump(v,f); f.flush(); os.fsync(f.fileno())
        os.replace(tmp,p)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)

def main():
    os.umask(0o077)
    if os.geteuid()!=0 or not ROOT.is_mount(): raise ValueError()
    private_path(ROOT,True); private_path(SECRETS,True)
    config=json.loads((SECRETS/'config.json').read_text())
    actual=subprocess.check_output(['findmnt','-n','-o','UUID','--target',str(ROOT)],text=True).strip()
    if set(config)!={'filesystemUuid'} or not re.fullmatch(r'[a-f0-9-]{36}',str(config['filesystemUuid'])) or actual!=config['filesystemUuid']: raise ValueError()
    for name in ['ssh-key','known_hosts','config.json']: private_path(SECRETS/name)
    directory=ROOT/'production';directory.mkdir(mode=0o700,exist_ok=True); private_path(directory,True)
    with (ROOT/'pull.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        reply=subprocess.run(SSH+['list'],capture_output=True,timeout=30,check=True).stdout
        if len(reply)>128*1024: raise ValueError()
        receipts=json.loads(reply)
        if not isinstance(receipts,list) or not 1<=len(receipts)<=32: raise ValueError()
        receipts=sorted([validate_receipt(v) for v in receipts],key=lambda v:v['createdAt'])
        if len({v['id'] for v in receipts})!=len(receipts): raise ValueError()
        for v in receipts:
            dest=directory/v['id'];dest.mkdir(mode=0o700,exist_ok=True);private_path(dest,True)
            final=dest/'snapshot.tar.age'
            if final.exists() or final.is_symlink():
                private_path(final)
                if final.stat().st_size!=v['bytes'] or digest(final)!=v['sha256']: raise ValueError()
            else:
                if shutil.disk_usage(ROOT).free<v['bytes']+4*1024**3: raise ValueError()
                fd,tmp=tempfile.mkstemp(prefix='.partial-',dir=dest)
                # Keep interrupted ciphertext for diagnosis; never promote it.
                with os.fdopen(fd,'wb') as out:
                    child=subprocess.Popen(SSH+['get '+v['id']],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
                    import selectors
                    selector=selectors.DefaultSelector();selector.register(child.stdout,selectors.EVENT_READ)
                    size=0;h=hashlib.sha256();deadline=time.monotonic()+900
                    try:
                        while True:
                            if time.monotonic()>deadline: raise TimeoutError()
                            if not selector.select(timeout=1): continue
                            block=os.read(child.stdout.fileno(),1024*1024)
                            if not block: break
                            size+=len(block)
                            if size>v['bytes']: raise ValueError()
                            h.update(block);out.write(block)
                        if child.wait(timeout=10)!=0 or size!=v['bytes'] or h.hexdigest()!=v['sha256']: raise ValueError()
                        out.flush();os.fsync(out.fileno())
                    finally:
                        selector.close();child.stdout.close()
                        if child.poll() is None: child.kill();child.wait()
                os.replace(tmp,final)
            receipt=dest/'receipt.json'
            if receipt.exists():
                private_path(receipt)
                if validate_receipt(json.loads(receipt.read_text()))!=v: raise ValueError()
            else: save_json(receipt,v)
        # Retain verified PVE history independently of the source's shorter retention.
        saved=[]
        for p in directory.iterdir():
            if not UUID.fullmatch(p.name): raise ValueError()
            private_path(p,True)
            if not (p/'receipt.json').exists(): continue
            private_path(p/'receipt.json');v=validate_receipt(json.loads((p/'receipt.json').read_text()))
            if p.name!=v['id']: raise ValueError()
            saved.append(v)
        # No automatic deletion: capacity failure preserves every existing recovery point.
        latest=receipts[-1]
        age=time.time()-datetime.datetime.fromisoformat(latest['createdAt'].replace('Z','+00:00')).timestamp()
        state={'version':1,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'healthy':age<8*3600,'availableSnapshots':len(saved),'latestId':latest['id'],'latestCreatedAt':latest['createdAt'],'plaintextStored':False,'macAcknowledgementModified':False}
        if not state['healthy']:
            save_json(ROOT/'status.json',state)
            raise ValueError()
        reply=subprocess.run(SSH+['ack-pve '+latest['id']+' '+latest['sha256']],capture_output=True,timeout=30,check=True).stdout
        if len(reply)>1024: raise ValueError()
        acknowledgement=json.loads(reply)
        if not isinstance(acknowledgement,dict) or set(acknowledgement)!={'acknowledged'} or acknowledgement['acknowledged'] is not True: raise ValueError()
        state['pveAcknowledged']=True
        save_json(ROOT/'status.json',state); print(json.dumps(state))

if __name__=='__main__':
    try: main()
    except Exception:
        print('{"error":"PVE_BACKUP_PULL_FAILED"}');raise SystemExit(1)
