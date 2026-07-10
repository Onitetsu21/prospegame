// Fonction Netlify : déclenche le workflow GitHub "scrape.yml" à la demande
// (bouton "Lancer un scrap" du dashboard). Le token GitHub reste côté serveur.
//
// Variables d'environnement Netlify requises :
//   • GITHUB_DISPATCH_TOKEN : PAT fine-grained avec permission "Actions: Read and write"
//   • GITHUB_REPO           : "Onitetsu21/prospegame" (optionnel, défaut ci-dessous)
//   • GITHUB_REF            : branche portant le workflow (optionnel, défaut "master")
//   • GITHUB_WORKFLOW_FILE  : nom du workflow (optionnel, défaut "scrape.yml")

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async () => {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO || 'Onitetsu21/prospegame';
  const ref = process.env.GITHUB_REF || 'master';
  const workflow = process.env.GITHUB_WORKFLOW_FILE || 'scrape.yml';

  if (!token) {
    return json(500, {
      error:
        "GITHUB_DISPATCH_TOKEN n'est pas configuré. Ajoute-le dans les variables " +
        "d'environnement Netlify (PAT GitHub avec Actions: read/write).",
    });
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'prospegame-dashboard',
      },
      body: JSON.stringify({ ref }),
    }
  );

  if (res.status === 204) return json(200, { ok: true, ref });
  const detail = await res.text();
  return json(res.status, { error: `GitHub API ${res.status}: ${detail.slice(0, 300)}` });
};
