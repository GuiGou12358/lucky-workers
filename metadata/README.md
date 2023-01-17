# Workers used by the dApp 'Lucky'

This project: 
- check the configuration of the smartcontracts 
- call the module dAppStaking to claim the rewards
- read data from subql before writing them in the smartcontrat 'Lucky Oracle'
- call the smart contract to start the raffle

## Preparation

#### Environment

- [Typescript](https://www.typescriptlang.org/) are required to compile project and define types.

- [Node](https://nodejs.org/en/).

#### Install 

Last, under the project directory, run following command to install all the dependency.

```
npm install
```

## Run

Last, under the project directory, run following command to install all the dependency.

```
npx ts-node src/workers.ts
```