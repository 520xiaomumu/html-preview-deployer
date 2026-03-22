const BASE_URL = process.env.SMOKE_BASE_URL || 'https://www.htmlcode.fun';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const code = `smoke${Math.floor(100000 + Math.random() * 900000)}`;

  const deployPayload = {
    filename: 'index.html',
    title: 'smoke-test',
    content: '<!doctype html><html><body><h1>Smoke Initial</h1></body></html>',
    enableCustomCode: true,
    customCode: code,
  };

  let deployRes = await fetch(`${BASE_URL}/api/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deployPayload),
  });

  if (deployRes.status === 429) {
    const cooldown = await deployRes.json();
    const waitSeconds = Math.max(1, Number(cooldown.retryAfterSeconds || 3));
    await sleep(waitSeconds * 1000);
    deployRes = await fetch(`${BASE_URL}/api/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deployPayload),
    });
  }

  const deploy = await deployRes.json();
  if (!deployRes.ok || !deploy.success) {
    throw new Error(`deploy failed: ${JSON.stringify(deploy)}`);
  }

  const readRes = await fetch(`${BASE_URL}/api/deploy/content?code=${code}`);
  const read = await readRes.json();
  if (!readRes.ok || !read.success || !String(read.content).includes('Smoke Initial')) {
    throw new Error(`read failed: ${JSON.stringify(read)}`);
  }

  const patchRes = await fetch(`${BASE_URL}/api/deploy/content`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      content: '<!doctype html><html><body><h1>Smoke Updated</h1></body></html>',
      filename: 'index-updated.html',
      title: 'smoke-test-updated',
    }),
  });

  const patch = await patchRes.json();
  if (!patchRes.ok || !patch.success) {
    throw new Error(`patch failed: ${JSON.stringify(patch)}`);
  }

  const downloadRes = await fetch(`${BASE_URL}/api/deploy/content?code=${code}&download=1`);
  const downloadText = await downloadRes.text();
  if (!downloadRes.ok || !downloadText.includes('Smoke Updated')) {
    throw new Error('download verification failed');
  }

  const pageRes = await fetch(`${BASE_URL}/s/${code}`);
  const pageText = await pageRes.text();
  if (!pageRes.ok || !pageText.includes('Smoke Updated')) {
    throw new Error('public page verification failed');
  }

  console.log(`SMOKE OK code=${code}`);
}

main().catch((error) => {
  console.error('SMOKE FAILED', error);
  process.exit(1);
});
