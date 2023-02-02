# Workers used by the dApp 'Lucky'

Offchain workers required to automate the raffle for Lucky dApp

This project: 
- display the current era for dApp staking
- display the last era when we ran the raffle
- check if the grants and the configuration in the smart contracts have been set
- call the module dAppStaking to claim the rewards
- read data from subql before writing them in the smartcontrat 'Lucky Oracle' (set the list of participants and rewards by era)
- call the smart contract to start the raffle


## Environment

- [Typescript](https://www.typescriptlang.org/)
- [Node](https://nodejs.org/en/).
- [Npx](https://www.npmjs.com/package/npx/).

## Install 

Last, under the project directory, run following command to install all the dependency.

```
npm install
```

## Run

Last, under the project directory, run following command to install all the dependency.

```
npx ts-node src/workers.ts [Options]
```

Options:
```
      --help                        Show help                          
      --ce, --currentEra            Display the current era for dApp staking
      --le, --lastEra               Display the last era when we ran the raffle
      --dc, --displayConfiguration  Diplay the configuration (contract and http addresses)
      --ch, --checks                Check if the grants and the configuration in the smart contracts have been set
      --cl, --claim                 Claim dappStaking developer rewards for a given era - era is mandatory
      --so, --setOracle             Set Oracle data for a given era - era is mandatory
      -r, --raffle                  Start the raffle for a given era - era is mandatory
      -a, --all                     Equivalent to --checks --claim --setOracle --raffle for a given era 
                                       or for for all era (from --lastEra to --currentEra) if no era is provided
      --era                         Given era                           
      --version                     Show version number      
```