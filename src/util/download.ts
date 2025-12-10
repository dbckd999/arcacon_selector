export async function downloadResource(url: string) {
  if (!url) return null;

  try {
    const res = await fetch(url);
    const type = res.headers.get('Content-Type') || '';

    if (!type.startsWith('image/') && !type.startsWith('video/'))
      throw new Error(`Unsupported type: ${type}`);

    const b = await res.blob();
    return b;
  } catch (error) {
    console.error('url:', url);
    console.error('리소스 다운로드 에러:', error);
    return null; // 또는 에러 처리에 따라 다른 값 반환
  }
}
