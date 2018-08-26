# gitthereum: git-based blockchain

# Introduction
## Overview
- Implement a blockchain on top of Git
- **Pizza Hackathon project**
- Proof of work
- Peer directory: `git remote -v`
  - To add peer: `git remote add`
- Block reward = 1,000,000

| **Blockchain**            | **Git**                                             |
| ------------------------- | --------------------------------------------------- |
| A node                    | Git repository                                      |
| Blockchain                | master branch                                       |
| Blockchain state          | repository contents of master branch                |
| Connecting to other nodes | Git remote + git fetch                              |
| Account                   | GPG keypair                                         |
| Account ID                | GPG key fingerprint                                 |
| Transaction               | commit ****that message starts with “transaction”   |
| Transaction sender        | commit author fingerprint                           |
| Transaction broadcast     | branch with                                         |
| Previous transaction      | previous commit                                     |
| Transaction ID            | commit hash                                         |
| Signed transaction        | merge commit “successful/failed transaction [id]”   |
| Block                     | merge commit message is with “block N” or “genesis” |
| Proof of work             | commit hash starts with 55                          |
| Parent block              | parent commit                                       |

## Repository layout
- accounts
  - **[account id]**
    - balance
  - **[contract id]**
    - contract.json
    - state.json
    - balance
    - code
## How to transfer
1. User publish transaction `{type: 'transfer', to: 'recipient'}`
## How to mine a block
1. For each node
  - `git fetch $NODE_URL`
    - We get everyone’s branches
    - Branch = transaction
      - Must have 1 commit
      - Commit must be signed
      - Commit hash = transaction ID
      - No file change (empty repo)
      - Branch name: `transaction/${commit_hash}`
2. `git checkout -f master`
3. `git reset` `--``hard` `master`
4. `git checkout -b my-block`
5. For each transaction
  - `git merge --no-commit ${transaction_id}`
  - Update state files.
  - `git add --all .`
  - `git commit`
6. At this point, `my-block` branch would contain every transaction received.
7. `git checkout -f master`
8. `git checkout -b master-staging`
9. `git merge` `--no-ff` `--no-commit my-block`
10. Update state file to add block reward.
11. `git commit -S -m 'block` `**1**` `[nonce 0]'`
12. Loop
  - `git commit --amend -S -m 'block` `**1**` `[nonce=``i++``]'`
  - If commit hash starts with `55`
    - break
  - `git reset --hard master`
  - Try again
- `git checkout master`
- `git merge --ff-only master-staging`
## Genesis block
1. `mkdir -p accounts/<ID>`
2. `echo -n` `**<REWARD>**` `> accounts/<ID>/balance`
3. `git commit`
4. Loop
  - If commit hash starts with `55`
    - break
  - `git commit` `--``amend`
## How to update
1. For each node
  - `git fetch $NODE_URL`
    - We get everyone’s master branch
2. For each master branch of each node
  - `git checkout their-branch`
    - Verify the branch
    - `git merge-base their-branch master`
    - Verify each commit


## How it should look like when running
1. For each node
  1. The node clones the plugin, run the initialization script
    1. The script run “git clone” to clone the chain from another running node.
    2. should be something like `gith init [chain-repo-dir]`
  2. The node starts a running process to operate the blockchain
    1. The process periodically pulls changes from other nodes listed in the chain repo’s remotes, do some magic, be happy
    2. should be something like `gith node`
2. For each miner node
  1. Initialize similar to normal nodes
  2. The running process acts differently:
    1. The process periodically attempt to create a new “block” (which is basically a commit that changes the state)
    2. The process fetches all pending transactions, verifies them, and tries to put them in the block
    3. The process then merges the created “block” into the master branch
    4. might be sonething like `gith node` `--``mine`
3. To interact with the chain:
  1. Done through some client software (probably a CLI or a Script)
  2. the software should be sending commands to an actual node, so users does not have to run a node to interact with the chain
# Usage
## Install GPG

Note: [GPG 2.2.9 doesn’t work](https://twitter.com/meedamian/status/1017956820822839296). Have to install 2.2.8.

    brew unlink gnupg # if already installed another version
    brew install https://raw.githubusercontent.com/Homebrew/homebrew-core/4451447c6a069b0f7ce5d8c88e4da7c4c89fbe52/Formula/gnupg.rb
## Generate your keypair (= wallet)
    $ gpg --gen-key

Note: your key should not have a passphrase
How to remove passphrase from existing key: https://lists.gnupg.org/pipermail/gnupg-users/2003-April/017623.html

## Find your key fingerprint
    $ gpg --list-keys --fingerprint
    
    pub   2048R/67B513AE 2018-08-25
          Key fingerprint = FEC3 82DA ED6E 95D8 E188  2263 5186 4AC2 67B5 13AE
## Set up Git to sign
    git config --global user.signingkey 67B513AE
## Your account ID

Replace space with /, and take only last 4 chunks (16 digits): **5186/4AC2/67B5/13AE**

## Let’s mine a block
1. Increate your balance by `1000000` by updating `accounts/<Account ID>/balance` and add 1000000 to the number.
2. Create a commit: `git commit -S -m 'block` `**1**` `[nonce``=``0]'`
  - Replace block **1** with (previous block number + 1)
3. While `git rev-parse HEAD` not start with '55'
  - `git commit --amend -S -m 'block` `**1**` `[nonce=``**1**``]'`


    # Ruby script
    i = 0
    block_number = 2
    loop do
      system "git commit --amend -S -m 'block #{block_number} [nonce=#{i += 1}]'"
      break if `git rev-parse HEAD`.start_with?('55')
    end
## Publish a transaction
    $ git checkout --orphan my-transaction
    $ git reset
    $ git commit -m 'transaction transfer {"to":"34B0/AF0B/3E84/D636","amount":555}' --allow-empty -S
    [my-transaction 04d3195] transaction transfer {"to":"34B0/AF0B/3E84/D636","amount":555}
    $ git branch -m transactions/$(git rev-parse HEAD)


## Git Daemon
    # 1. Allow 
    cd chain
    touch .git/git-daemon-export-ok
    git daemon --reuseaddr --base-path=$(pwd) $(pwd)
    
    git remote add <ip> git://<ip>/
# Technical details
## Proof of work
- The block’s commit ID must start with `55`.
## Commit message convention
|                                    | **Commit message**                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| Genesis block                      | `genesis [nonce=X]`                                                            |
| Subsequent block                   | `block 1 [nonce=X]`                                                            |
| Transaction                        | `transaction transfer {"to":"","amount":999}`                                  |
| Transaction being put into a block | `successful` ```transaction COMMIT_ID`

`failed transaction COMMIT_ID: reason` |

## Git branches
|             | **Branch name**           |
| ----------- | ------------------------- |
| Transaction | `transaction/<commit_id>` |
| Main chain  | `master`                  |

## Smart contract

Example contract:

- When 2 people send money to that contract, it will send total received money to one of randomly-chosen person.


    // contract.js
    module.exports = {
      initialState: { members: [] },
      /**
       * @param {*} state - copy of current state (you can mutate it)
       * @param {Object} action - user-specified payload
       * @param {Object} context
       * @param {{ id: string }} context.sender - user who invoked contract
       * @param {string} context.hash - the current sha of "my-block" branch (can use as random source)
       * @param {string} context.minerId - the ID of miner (can also use as random source)
       * @param {number} context.balance - the amount of money in contract
       * @param {(id: string, amount: number)} context.transferTo - send money
       * @return the next state
       */
      reducer(state, action, context) {
        state.members.push(context.sender.id)
        if (state.members.length >= 2) {
          const random = parseInt(context.hash.substr(0, 4), 16) ^ parseInt(context.minerId.substr(0, 4), 16)
          const target = random % state.members.length
          context.transferTo(state.members[target], context.balance)
          state.members = []
        }
        return state
      }
    }

Contract ID:

- `git hash-object contract.js`
  - → 8446bc10a60d5bcc28b07ad552b881b13ee112a3
- Take last 16 digits
  - → 52B8/81B1/3EE1/12A3

Creating contract:

- commit title: “create contract 52B8/81B1/3EE1/12A3”
  - commit contains contract.js in `accounts/52B8/81B1/3EE1/12A3/contract.js`
  - contract ID must match contract.js

When transferring money to contract…

- Update its balance first
- If it contains `contract.js` then require and run it :P
## CLI commands
    $ node ../gitthereum/bin/check-balance '<user id>'
    1999863
    
    $ node ../gitthereum/bin/create-transaction transfer --to='...' --amount=123
    04d3195 # (commit hash = transaction id)
    
    $ node ../gitthereum/bin/verify-transaction 04d3195
    pending / success / failed: reason
    
    $ node ../gitthereum/bin/sync-remotes
    
    $ node ../gitthereum/bin/process-transactions
    # [reset to master, creates "my-block" branch,
    #  and process transactions that haven’t been processed yet
    #  by running `git branch --all` and look for `transactions/*` branches]
    
    $ node ../gitthereum/bin/mine-block
    # [mines a block... if "my-block" branch is available, then mine with
    #  transactions. otherwise, just mine without processing transaction.
      #  make sure to update your transaction]
    
    $ node ../gitthereum/bin/verify-block <commit>
    # [verifies that a block is valid]
