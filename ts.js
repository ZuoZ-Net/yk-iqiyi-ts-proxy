// EdgeOne Pages 边缘函数：优酷 / 爱奇艺 ts 分片代理中转
// 访问形式：
//   https://你的域名/ts?p=qy&ts=<base64分片地址>   爱奇艺
//   https://你的域名/ts?p=yk&ts=<base64分片地址>   优酷
// 不带 p 时按目标域名自动识别平台。

const PROFILES = {
  yk: {
    Origin: 'https://v.youku.com',
    Referer: 'https://v.youku.com/',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  },
  qy: {
    Origin: 'https://www.iqiyi.com',
    Referer: 'https://www.iqiyi.com',
    'User-Agent':
      'Dalvik/2.1.0 (Linux; U; Android 10; CDY-AN00 Build/HUAWEICDY-AN00) imgotv-aphone-7.2.6',
  },
};

export async function onRequest({ request }) {
  const u = new URL(request.url);

  // 预检请求直接放行
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  const tsParam = u.searchParams.get('ts');
  if (!tsParam) {
    return json({ code: 400, msg: 'missing ts param' }, 400);
  }

  // base64 解码（修复 + 被解析成空格的问题，与 PHP 版一致）
  let target;
  try {
    target = atob(tsParam.replace(/ /g, '+'));
  } catch (e) {
    return json({ code: 400, msg: 'bad base64' }, 400);
  }

  // 只允许 http/https，避免被当作开放代理滥用
  if (!/^https?:\/\//i.test(target)) {
    return json({ code: 400, msg: 'invalid target' }, 400);
  }

  // 平台判别：显式 p 优先，否则按域名自动识别
  let platform = u.searchParams.get('p');
  if (!platform) {
    if (/youku|wasu|alicdn|cp\d+\./i.test(target)) platform = 'yk';
    else if (/iqiyi|qiyi|qy\d|71\.am|cache\.m/i.test(target)) platform = 'qy';
  }
  const profile = PROFILES[platform] || PROFILES.qy;

  let resp;
  try {
    resp = await fetch(target, { headers: profile });
  } catch (e) {
    return json({ code: 502, msg: 'upstream fetch failed', err: String(e) }, 502);
  }

  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
