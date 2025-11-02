const logresult = document.getElementById('log');

// 키클락 로그인-힌트로 구글 로그인으로 바로 이동
const CLIENT_ID = 'google-arcacon-search';
const CLIENT_REALM = 'google-arcacon-realm';
const AUTH_HOST = 'auth.dbckd999.xyz';
const REQ_API_URL = `https://${AUTH_HOST}/realms/${CLIENT_REALM}/protocol/openid-connect/auth`;
const REDIRECT_URL = chrome.identity.getRedirectURL();

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('authButton').addEventListener('click', signup);
});

// PKCE용 랜덤 verifier 생성
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// SHA-256으로 code_challenge 생성
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function parseJwt(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split('')
      .map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join('')
  );

  return JSON.parse(jsonPayload);
}

/** 회원가입
 * 1. 키클락에 가입/토큰발급 요청
 * 2. 키클락은 구글에서 토큰을 받아 보관
 * 3. 클라이언트는 다시 키클락에 엑세스토큰을 요청
 * 4. 해당 토큰은 브라우저 로컬 스토리지에 보관
 */
async function signup() {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  // 나중에 토큰 교환 때 쓸 verifier 저장
  await chrome.storage.local.set({ code_verifier: verifier });
  let u = new URL(REQ_API_URL);
  u.searchParams.set('client_id', CLIENT_ID);
  u.searchParams.set('redirect_uri', REDIRECT_URL);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid offline_access');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('state', crypto.randomUUID());
  u.searchParams.set('kc_idp_hint', 'google');
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');

  chrome.identity.launchWebAuthFlow(
    {
      url: u.href,
      interactive: true,
    },
    async (redirectUrl) => {
      if (!redirectUrl) {
        console.error('Auth flow failed or was cancelled');
        return;
      }

      const code = new URL(redirectUrl).searchParams.get('code');
      if (!code) return console.error('No code returned');

      const tokenRes = await fetch(
        `https://${AUTH_HOST}/realms/${CLIENT_REALM}/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            code: code,
            redirect_uri: chrome.identity.getRedirectURL(),
            code_verifier: verifier,
          }),
        }
      );

      const tokenData = await tokenRes.json();
      await chrome.storage.local.set({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Date.now() + tokenData.expires_in * 1000,
      });
      console.log('Token saved to local storage');
      console.log(parseJwt(tokenData.access_token));
    });
}

/** 엑세스토큰 사용/재발급
 * 1. 만료직전 (발급일로 1/10 정도 남았을때) 발급시작
 * 2. 스토리지에서 refresh_token을 가져옴
 * 3. 키클락 엔드포인트에 재발급 요청
 * 4. 새로운 토큰들을 스토리지에 저장
 * @returns {Promise<string|null>} 유효한 access_token 또는 실패 시 null
 */

document
  .getElementById('getAccess')
  .addEventListener('click', regenAccessToken);
async function regenAccessToken() {
  const { refresh_token } = await chrome.storage.local.get('refresh_token');
  if (!refresh_token) {
    console.log('No refresh token found. User needs to sign in.');
    return null;
  }

  console.log('Attempting to refresh the access token...');

  try {
    const tokenRes = await fetch(
      `https://${AUTH_HOST}/realms/${CLIENT_REALM}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: CLIENT_ID,
          refresh_token: refresh_token,
        }),
      }
    );

    if (!tokenRes.ok) {
      const errorData = await tokenRes.json();
      throw new Error(
        `Failed to refresh token: ${errorData.error_description || tokenRes.statusText
        }`
      );
    }

    const tokenData = await tokenRes.json();

    // Debug
    console.log(parseJwt(tokenData.access_token));

    await chrome.storage.local.set({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
    });

    console.log('✅ Token refreshed and saved successfully.');
    return tokenData.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    // 재발급 실패 시 (예: refresh token 만료) 저장된 토큰을 지우고 재로그인을 유도할 수 있습니다.
    await chrome.storage.local.remove([
      'access_token',
      'refresh_token',
      'expires_at',
    ]);
    return null;
  }
}

/**
 * 스토리지에서 유효한 Access Token을 가져옵니다.
 * 만료되었거나 곧 만료될 경우, 자동으로 재발급을 시도합니다.
 */
async function getAccessToken() {
  const { access_token, expires_at } = await chrome.storage.local.get([
    'access_token',
    'expires_at',
  ]);

  // 토큰이 만료 1분 전이라면 재발급
  // TODO 키클락 서버 발급하는시간 확인
  // if (!access_token || !expires_at || expires_at < Date.now()) {
  //     return await regenAccessToken();
  // }

  console.log('Found valid access token in storage.');
  return access_token;
}

document.getElementById('secureBtn').addEventListener('click', async () => {
  // chrome.storage에서 저장된 access token 가져오기
  const access_token = await getAccessToken();
  if (!access_token) {
    console.log('No access token found. Please login first.');
    return;
  }

  try {
    const res = await fetch('https://api.dbckd999.xyz/secure', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.log(`Error: ${res.status} ${res.statusText}`);
      return;
    }

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.log('Fetch error: ' + err);
  }
});

document.getElementById('new_test').addEventListener('click', async () => {
  const access_token = await getAccessToken();
  if (!access_token) {
    console.log('No access token found. Please login first.');
    return;
  }
  const url = new URL('https://api.dbckd999.xyz/new');
  url.searchParams.append('thumbnail_id', '83185');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${access_token}`,
        // GET 요청에서는 Content-Type 헤더가 필요하지 않습니다.
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('Fetch error:', error);
  }
});
