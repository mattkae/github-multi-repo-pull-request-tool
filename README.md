# Github Multi Repo Pull Request Tool

## Purpose
Create pull requests in multiple repositories and link them to one another.

## Features
- Create pull requests for multiple repositories
- Link those pull requests between one another via keywords
- Make those pull requests have the same body, title, and ticket reference
- Add a trusted set of reviewers to those pull requests automatically

## Requirements
node 12+

## Usage
When you want to open a cross-repo pull request, you will do the following:

1. Update `content.md` file with the body of the pull request. This markdown file can include a few keywords to automatically fill in the blanks for you:
   - **$TITLE**: Creates an `h1` in your markdown containing the title specified in your `config.json`
   - **$FIXES**: Create an `h2` section containing the ticket number that was fixed by your work
   - **$MERGE_WITH**: Creates an `h2` section containing links to the repositories that will be merge with this pull request
   
2. Create file `config.json` at the root like so:
```ts
{
   "pat": string,           // Github personal access token
   "title": string,         // Title of the ticket
   "fixes"?: {
      "repository": string, // Repository where the ticket lives
      "issue": number       // Ticket number
   },
   "reviewers"?: Array<string>, // Array of user names to review your pull request
   "repositories": [
      {
         "owner": string,     // Owner of the repository
         "name": string,      // Name of the repository
         "head": string,      // Branch that your work is on
         "base": string,      // Branch that you are merging into
         "disabled"?: boolean // Specifies whether or not this repo should be ignored [default = false]
      }
  ]
}
```
The **title** and **fixes** fields are bound to change between runs. Also, you may want to **disable** certain repositories depending on whether they are being used for that particular pull request.

3. Install dependencies and run
```sh
npm install
npm run start
```

