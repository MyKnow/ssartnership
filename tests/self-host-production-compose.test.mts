import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require=createRequire(import.meta.url);
const {load}=require('js-yaml');
test('Production application and monitoring use separate data networks, secrets and volumes',()=>{
 const source=readFileSync(new URL('../deploy/self-host/compose.production.yaml',import.meta.url),'utf8');
 const config=load(source);
 assert.doesNotMatch(source,/original-preview|infra-dev|3108:|59190:|53100:/);
 assert.equal(config.networks.production_default.name,'ssartnership-production-data_default');
 assert.equal(config.networks.production_edge.name,'ssartnership-production-data_edge');
 assert.equal(config.networks.monitoring.internal,true);
 for(const service of Object.values(config.services) as {ports?:string[]}[]){
  for(const port of service.ports??[]) assert.match(port,/^127\.0\.0\.1:/);
 }
 assert.match(config.services.app.image,/SELF_HOST_IMAGE:\?/);
 assert.match(config.services.app.env_file[0],/ssartnership-production\/app.env/);
 assert.equal(config.services.grafana.environment.GF_AUTH_ANONYMOUS_ENABLED,'false');
 assert.equal(config.services.grafana.environment.GF_SECURITY_COOKIE_SECURE,'true');
 assert.equal(config.services.grafana.environment.GF_SERVER_ROOT_URL,'https://ssartnership-infra.myknow.xyz/infra/grafana/');
 for(const volume of Object.keys(config.volumes)) assert.match(volume,/^production-/);
});
