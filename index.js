const { Octokit } = require('octokit');
const fs = require('fs');

async function login() {
  // Read in the config.
  let configuration;
  try {
    const fileReadResult = fs.readFileSync('./config.json');
    configuration = JSON.parse(fileReadResult.toString());
    console.log('Configuration parsed.', configuration);
  }
  catch (e) {
    console.error('Unable to partse the configuration', e);
    throw e;
  }

  try {
    const octokit = new Octokit({
      auth: configuration.pat
    });
    const { data: { login }, } = await octokit.rest.users.getAuthenticated();
    console.info('User logged in as: ' + login);
    return { octokit, configuration };
  }
  catch (e) {
    console.error('Unable to login: ', e);
    throw e;
  }
}

function getTitle(configuration) {
  return `(#${configuration.fixes.issue}) ${configuration.title}`;
}

function getBody(configuration) {
  let prBody = fs.readFileSync('./content.md').toString()
		.replace('$TITLE', '# ' + getTitle(configuration));

  if (configuration.fixes) {
	prBody = prBody.replace('$FIXES', `## Fixes
fixes ${configuration.fixes.repository}/issues/${configuration.fixes.issue}`);
  }
  else {
	prBody = prBody.replace('$FIXES', '');
  }

  return prBody;
}

async function createPullRequests({ octokit, configuration }) { 
  const body = getBody(configuration);
  const createdPullRequests = [];

  // Make pull requests in all repositories
  await Promise.all(configuration.repositories.map(async function(repo) {
	try {
	  const createResult = await octokit.rest.pulls.create({
      owner: repo.owner,
      repo: repo.name,
      title: getTitle(configuration),
      draft: true,
      head: repo.head,
      base: repo.base,
      body: body
	  });
	  console.info('Pull request created: ' + createResult.data.html_url);

	  createdPullRequests.push({
      name: repo.name,
      url: createResult.data.html_url,
      number: createResult.data.number
	  });
	}
	catch(e) {
	  console.error('Unable to create pull request for repo: ' + repo, e);
	}
  }));

  return { octokit, body, configuration, createdPullRequests };
}

async function updatePullRequests({ octokit, body, configuration, createdPullRequests }) {
 await Promise.all(configuration.repositories.map(async function(repo) {
	try {
	  const myPr = createdPullRequests.find(pr => pr.name === repo.name);
	  const linkedPrs = createdPullRequests.filter(pr => pr.name !== repo.name).map(pr => '- ' + pr.url);

	  if (linkedPrs.length === 0) {
		  body = body.replace('$MERGE_WITH', '');
	  }
	  else {
		  body = body.replace('$MERGE_WITH', `## Merge with
${linkedPrs.join('\n')}`);
	  }

	  const updateResult = await octokit.rest.pulls.update({
      owner: repo.owner,
      repo: repo.name,
      pull_number: myPr.number,
      body: thisPrBody
	  });

	  console.info('Pull request updated: ' + updateResult.data.html_url);
	}
	catch (e) {
	  console.error('Unable to update pull request for repo: ' + repo, e);
	}
  }));
}

login();//.then(createPullRequests).then(updatePullRequests);
