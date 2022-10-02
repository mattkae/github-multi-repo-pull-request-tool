const { Octokit } = require('octokit');
const fs = require('fs');
const readline = require('readline');
const { stdin, stdout, exit } = require('process');

async function readConfiguration() {
  try {
    const fileReadResult = fs.readFileSync('./config.json');
    const configuration = JSON.parse(fileReadResult.toString());
    return { configuration };
  }
  catch (e) {
    console.error('Unable to partse the configuration', e.message);
    throw e;
  }
}

function spawnEditor(onComplete) {
  fs.copyFileSync('./default_content.md', '/tmp/content.md');
  const vim = require('child_process').spawn(process.env.EDITOR || 'vim', ['/tmp/content.md'], { stdio: 'inherit' });
  vim.on('exit', function(code) {
    console.log('Exited with code: ' + code);
    onComplete();
  });
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function input({ configuration }) {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const repoSelection = configuration.repositories.map((repo, index) => (index + 1) + ') ' + repo.name).join('\n  ');
    let repoAnswer = await ask(rl, 'Which repositories does this affect? (Default = all) separate selection by commas\n  ' + repoSelection + '\n');
    repoAnswer = repoAnswer.trim();
    if (repoAnswer.length > 0) {
      const repos = repoAnswer.split(',').map(answer => answer.trim()).map(answer => parseInt(answer) - 1);
      configuration.repositories = configuration.repositories.filter((repo, index) => repos.find(value => value === index) !== undefined);
      if (configuration.repositories.length === 0) {
        throw new Error('You must select at least one valid repository.');
      }
    }
  }
  catch (e) {
    console.error('Invalid repository selection: ', e.message);
    throw e;
  }

  try {
    console.log('Please enter the BASE branch for each repo: ');
    for (const repo of configuration.repositories) {
      let isAnswered = false;
      while (!isAnswered) {
        if (repo.defaultBase) {
          repo.base = await ask(rl, '  ' + repo.name + ' (default = ' + (repo.defaultBase) + '): ');
        }
        else {
          repo.base = await ask(rl, '  ' + repo.name + ': ');
        }

        repo.base = repo.base.trim();
        if (repo.base.length === 0) {
          if (repo.defaultBase === undefined) {
            console.log(('You must select a base branch or specify a default base branch in your config.'));
            continue;
          }
          else {
            repo.base = repo.defaultBase;
            isAnswered = true;
          }
        }
        else {
          isAnswered = true;
        }
      }
    }
  }
  catch (e) {
    console.error('Failed to set base branch', e.message);
    throw e;
  }

  try {
    console.log('Please enter the HEAD branch for each repo: ');
    for (const repo of configuration.repositories) {
      let isAnswered = false;
      while (!isAnswered) {
        repo.head = await ask(rl, '  ' + repo.name + ': ');
        repo.head = repo.head.trim();
        if (repo.head.length === 0) {
          console.log('You must specify a head branch.');
          continue;
        }

        isAnswered = true;
      }
    }
  }
  catch (e) {
    console.error('Failed to set head branch', e.message);
    throw e;
  }

  try {
    const title = await ask(rl, 'What is the title of your pull request?\n');
    configuration.title = title.trim();
    if (configuration.title.length === 0) {
      throw new Error('You must enter a title');
    }
  }
  catch (e) {
    console.error('Invalid title selection: ', e.message);
    throw e;
  }

  try {
    const ticket = await ask(rl, 'What ticket is this for (link please)? [Default = no ticket]\n');
    configuration.ticket = ticket.trim();
  }
  catch (e) {
    console.error('Invalid title selection: ', e.message);
    throw e;
  }

  try {
    rl.close();
    await new Promise(resolve => spawnEditor(resolve));
  }
  catch (e) {
    console.error('Invalid title selection: ', e.message);
    throw e;
  }

  return { configuration };
}

async function login({ configuration }) {
  // Read in the config.
  try {
    const octokit = new Octokit({
      auth: configuration.pat
    });
    const { data: { login }, } = await octokit.rest.users.getAuthenticated();
    console.info('User logged in as: ' + login);
    return { octokit, configuration };
  }
  catch (e) {
    console.error('Unable to login: ', e.message);
    throw e;
  }
}

function getTitle(configuration) {
  if (configuration.ticket) {
    const number = configuration.ticket.substring(configuration.ticket.lastIndexOf('/'));
    return `(#${number}) ${configuration.title}`;
  }
  else {
    return configuration.title;
  }
}

function getBody(configuration) {
  let prBody = fs.readFileSync('/tmp/content.md').toString()
    .replace('$TITLE', '# ' + getTitle(configuration));

  if (configuration.ticket) {
    prBody = prBody.replace('$FIXES', `## Fixes
fixes ${configuration.ticket}`);
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
  await Promise.all(configuration.repositories.map(async function (repo) {
    try {
      const createResult = await octokit.rest.pulls.create({
        owner: repo.owner,
        repo: repo.name,
        title: getTitle(configuration),
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
    catch (e) {
      console.error('Unable to create pull request for repo: ' + repo, e.message);
    }
  }));

  return { octokit, body, configuration, createdPullRequests };
}

async function updatePullRequests({ octokit, body, configuration, createdPullRequests }) {
  await Promise.all(configuration.repositories.map(async function (repo) {
    try {
      let myBody = body;
      const myPr = createdPullRequests.find(pr => pr.name === repo.name);
      const linkedPrs = createdPullRequests.filter(pr => pr.name !== repo.name).map(pr => '- ' + pr.url);

      if (linkedPrs.length === 0) {
        myBody = myBody.replace('$MERGE_WITH', '');
      }
      else {
        myBody = myBody.replace('$MERGE_WITH', `## Merge with
${linkedPrs.join('\n')}`);
      }

      const updateResult = await octokit.rest.pulls.update({
        owner: repo.owner,
        repo: repo.name,
        pull_number: myPr.number,
        body: myBody
      });

      console.info('Pull request updated: ' + updateResult.data.html_url);
    }
    catch (e) {
      console.error('Unable to update pull request for repo: ' + repo + ', error: ', e.message);
      throw e;
    }
  }));

  return { octokit, configuration, createdPullRequests };
}


async function requestReviewers({ createdPullRequests, configuration, octokit }) {
  try {
    if (configuration.reviewers) {
      for (const pr of createdPullRequests) {
        const repo = configuration.repositories.find(repo => pr.name === repo.name);
        const result = await octokit.rest.pulls.requestReviewers({
          owner: repo.owner,
          repo: repo.name,
          pull_number: pr.number,
          reviewers: configuration.reviewers
        });

        console.log('Reviewers added to for: ' + result.data.html_url);
      }
    }
  }
  catch (e) {
    console.error('Unable to add reviewers', e.message);
    throw e;
  }
}

readConfiguration().then(input)
  .then(login)
  .then(createPullRequests)
  .then(updatePullRequests)
  .then(requestReviewers)
  .catch(() => {
    console.log('Terminated.');
    exit(1);
  });
