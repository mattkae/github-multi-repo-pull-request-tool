# Github Multi Repo Pull Request Tool

## Purpose
Open pull requests across multiple repositories and link them to one another

## Features
- Create pull requests across multiple repositories at the same time
- Automatically have those pull requests have the same body, title, and ticket reference
- Link those pull requests between one another
- Add a trusted set of reviewers to those pull requests automatically

## Requirements
node 12+

## Installation
```sh
git clone https://github.com/mattkae/github-multi-repo-pull-request-tool.git
cd ./github-multi-repo-pull-request-tool
npm install
```

## Setup
1. Update `default_content.md` file with a template for your pull requests. Include the following keywords to automatically fill in the blanks for you:
   - **$TITLE**: Creates an `h1` in your markdown containing the title specified in your `config.json`
   - **$FIXES**: Creates an `h2` section containing the ticket number that was fixed by your work
   - **$MERGE_WITH**: Creates an `h2` section containing links to the repositories that will be merge with this pull request
   
2. Create file `config.json` at the root of this project like so:
```ts
{
    "pat": "YOUR_GITHUB_PAT",
    "reviewers": [ "username1", "username2" ],
    "browser": true,                   // Optional. If set, the PRs will open in the browser in the end
    "repositories": [
       {
          "owner": "MyName_Or_Company",
          "name": "MyCoolRepo",
          "defaultBase": "master",     // Optional (default = none)
          "disable": false             // Optional (default = false)
       }
   ]
 }
```

## Usage
Run:
```sh
npm run start
```

Then follow the prompts to create your pull requests. That's it!
