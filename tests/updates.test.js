'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Updates = require('../app/src/main/assets/updates.js');

test('version comparison understands tags and numeric components', () => {
  assert.equal(Updates.compareVersions('v0.3.2', '0.3.1'), 1);
  assert.equal(Updates.compareVersions('0.3.10', '0.3.9'), 1);
  assert.equal(Updates.compareVersions('0.3.1', 'v0.3.1'), 0);
  assert.equal(Updates.compareVersions('0.2.9', '0.3.1'), -1);
  assert.throws(() => Updates.compareVersions('garbage', '0.3.1'));
});

test('network request happens only when user invokes checkForUpdates', async () => {
  const requests = [];
  const fakeFetch = async (url, options) => {
    requests.push({url, options});
    return {ok: true, json: async () => ({
      tag_name: 'v0.3.2',
      html_url: 'https://github.com/huseyinozcanasta/Yolculuk66/releases/tag/v0.3.2',
      assets: [{
        name: 'Yolculuk66-v0.3.2.apk',
        browser_download_url: 'https://github.com/huseyinozcanasta/Yolculuk66/releases/download/v0.3.2/Yolculuk66-v0.3.2.apk'
      }]
    })};
  };
  assert.equal(requests.length, 0);
  const result = await Updates.checkForUpdates(fakeFetch, '0.3.1');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, Updates.RELEASE_API);
  assert.equal(result.status, 'available');
  assert.equal(result.latestVersion, '0.3.2');
  assert.match(result.apkUrl, /Yolculuk66-v0.3.2.apk$/);
});

test('equal or older release never reports an update', async () => {
  const fakeFetch = async () => ({ok:true, json:async()=>({tag_name:'v0.3.0',html_url:'https://github.com/huseyinozcanasta/Yolculuk66/releases/tag/v0.3.0',assets:[]})});
  const result = await Updates.checkForUpdates(fakeFetch,'0.3.1');
  assert.equal(result.status,'current');
  assert.equal(result.apkUrl,null);
});

test('rejects untrusted download URLs', async () => {
  const fakeFetch = async () => ({ok:true,json:async()=>({
    tag_name:'v9.0.0',
    html_url:'https://evil.example/fake',
    assets:[{name:'Yolculuk66.apk',browser_download_url:'https://evil.example/malicious.apk'}]
  })});
  const result = await Updates.checkForUpdates(fakeFetch,'0.3.1');
  assert.equal(result.status,'available');
  assert.equal(result.apkUrl,null);
  assert.equal(result.releaseUrl,Updates.RELEASES_URL);
});

test('offline failures do not become false update claims', async () => {
  const fakeFetch = async () => {throw new Error('offline');};
  await assert.rejects(Updates.checkForUpdates(fakeFetch,'0.3.1'), /bağlantı|kontrol/i);
});

test('release list discovers newer pre-release without selecting drafts',async()=>{
 const payload=[
   {tag_name:'v0.9.0',draft:true,prerelease:false,assets:[],html_url:'https://github.com/huseyinozcanasta/Yolculuk66/releases/tag/v0.9.0'},
   {tag_name:'v0.3.2',draft:false,prerelease:true,assets:[],html_url:'https://github.com/huseyinozcanasta/Yolculuk66/releases/tag/v0.3.2'},
   {tag_name:'v0.3.3',draft:false,prerelease:true,
     assets:[{name:'Yolculuk66-v0.3.3.apk',browser_download_url:'https://github.com/huseyinozcanasta/Yolculuk66/releases/download/v0.3.3/Yolculuk66-v0.3.3.apk'}],
     html_url:'https://github.com/huseyinozcanasta/Yolculuk66/releases/tag/v0.3.3'}
 ];
 const result=await Updates.checkForUpdates(async()=>({ok:true,json:async()=>payload}),'0.3.2');
 assert.equal(result.latestVersion,'0.3.3');
 assert.equal(result.isPrerelease,true);
 assert.equal(result.status,'available');
 assert.match(Updates.RELEASE_API,/\/releases\?per_page=/);
});
test('a release list with no public versions fails explicitly',async()=>{
 const mock=async()=>({ok:true,json:async()=>[{tag_name:'v0.9.0',draft:true}]});
 await assert.rejects(Updates.checkForUpdates(mock,'0.3.2'),/sürüm|yayın/i);
});
