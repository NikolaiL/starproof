import { after } from 'node:test';
import { mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {X509Certificate,sign,generateKeyPairSync,createHash} from 'node:crypto';
import {createTrustVerifier} from 'wedgie-actions/server';

export function testIdentity() {
  const dir=mkdtempSync(join(tmpdir(),'starproof-drop-test-'));
  after(()=>rmSync(dir,{recursive:true,force:true}));
  const openssl=(...args)=>execFileSync('openssl',args,{cwd:dir,stdio:'pipe'});
  openssl('req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-keyout','root.key','-out','root.pem','-subj','/CN=Starproof TEST ROOT','-days','2','-addext','basicConstraints=critical,CA:TRUE,pathlen:1','-addext','keyUsage=critical,keyCertSign,cRLSign');
  for(const name of ['issuer','device']) {
    openssl('req','-new','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-keyout',name+'.key','-out',name+'.csr','-subj','/CN=Starproof TEST '+name);
    writeFileSync(join(dir,name+'.ext'),name==='issuer'?'basicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\n':'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\n');
    const parent=name==='issuer'?'root':'issuer';
    openssl('x509','-req','-in',name+'.csr','-CA',parent+'.pem','-CAkey',parent+'.key','-CAcreateserial','-out',name+'.pem','-days','1','-extfile',name+'.ext');
  }
  const cert=name=>new X509Certificate(readFileSync(join(dir,name+'.pem')));
  const device=cert('device'),certificate=device.raw.toString('hex'),factory=readFileSync(join(dir,'device.key'));
  const verifier=createTrustVerifier([cert('root')],[cert('issuer')]);
  const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),point=key.publicKey.export({format:'jwk'});
  const wallet={x:'0x'+Buffer.from(point.x,'base64url').toString('hex'),y:'0x'+Buffer.from(point.y,'base64url').toString('hex')};
  const signature=(privateKey,bytes)=>sign('sha256',bytes,{key:privateKey,dsaEncoding:'ieee-p1363'});
  const words=bytes=>({r:'0x'+bytes.subarray(0,32).toString('hex'),s:'0x'+bytes.subarray(32).toString('hex')});
  const prove=text=>{
    const code=text.split('\n').find(line=>line.startsWith('nonce=')).slice(6);
    const inner=createHash('sha256').update(text+'\n'+code).digest();
    const walletSignature=words(signature(key.privateKey,Buffer.concat([Buffer.from('wedgie prove\0'),inner])));
    const binding=words(signature(factory,Buffer.concat([Buffer.from('wedgie safe key\0'),Buffer.from(wallet.x.slice(2)+wallet.y.slice(2),'hex')])));
    return {text,code,...wallet,...walletSignature,cert:certificate,fr:binding.r,fs:binding.s};
  };
  return {certificate,verifier,wallet,prove};
}
