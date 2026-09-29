import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPublicHealth } from '../scripts/self-host-operations/verify-public-health.mjs';

const responseFor = (url: string) => url.includes('-infra')
  ? new Response('Unauthorized', {status:401,headers:{'www-authenticate':'Basic realm="infra"'}})
  : Response.json({status:'ok'}, {headers:{'cache-control':'no-store'}});

test('public verification only requests fixed HTTPS origins without credentials, redirects or retries', async () => {
  const urls: string[]=[];
  const result=await verifyPublicHealth(async (input, options) => {
    const url=String(input);
    assert.ok(options);
    urls.push(url);
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'error');
    assert.equal(options.headers && Object.hasOwn(options.headers,'authorization'),false);
    assert.equal(options.headers && Object.hasOwn(options.headers,'cookie'),false);
    assert.ok(options.signal);
    return responseFor(url);
  });
  assert.deepEqual(urls,[
    'https://ssartnership.myknow.xyz/api/health',
    'https://ssartnership-dev.myknow.xyz/api/health',
    'https://ssartnership-infra.myknow.xyz/infra/prometheus/',
    'https://ssartnership-infra-dev.myknow.xyz/infra/prometheus/',
  ]);
  assert.equal(result.length,4);
  assert.ok(result.every((r: {passed:boolean})=>r.passed));
});

test('public verification rejects wrong health bodies and unprotected infrastructure', async () => {
  for (const make of [()=>Response.json({status:'down'},{headers:{'cache-control':'no-store'}}),()=>Response.json({status:'ok',extra:true},{headers:{'cache-control':'no-store'}}),()=>new Response('<html>error</html>'),()=>new Response('x'.repeat(5000),{headers:{'content-type':'application/json','cache-control':'no-store'}}),()=>new Response(null,{status:302}),()=>new Response(null,{status:401})]) {
    const results=await verifyPublicHealth(async()=>make());
    assert.ok(results.every((r: {passed:boolean})=>!r.passed));
  }
});

test('public network or TLS failure is visible and never reveals provider error text', async () => {
  let calls=0;
  const results=await verifyPublicHealth(async()=>{calls++;throw Error('private provider details');});
  assert.equal(calls,4);
  assert.ok(results.every((r: {passed:boolean})=>!r.passed));
  assert.ok(!JSON.stringify(results).includes('private provider'));
});
