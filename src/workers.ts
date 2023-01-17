import { KeyringPair } from '@polkadot/keyring/types';
import { ApiPromise, WsProvider, Keyring} from '@polkadot/api';
import { ContractPromise, Abi } from '@polkadot/api-contract';
import type { ISubmittableResult} from '@polkadot/types/types';
import { Balance, WeightV2 } from '@polkadot/types/interfaces';
import { setTimeout } from 'timers/promises';
import { readFileSync } from 'fs';
import fetch from 'node-fetch';
import {Config} from './config';


const config = new Config();

let api : ApiPromise;
let keyring : Keyring;
let worker : KeyringPair;

const dAppStakingApplicationContractAddress = config.dAppStakingApplicationContractAddress;
const dAppStakingDeveloperContractAddress = config.dAppStakingDeveloperContractAddress;
const dAppStakingDeveloperContractMetadata = readFileSync('./metadata/dapps_staking_developer_metadata.json');
let dAppStakingDeveloperContract : ContractPromise;

const luckyOracleContractAddress = config.luckyOracleContractAddress;
const luckyOracleContractMetadata = readFileSync('./metadata/lucky_oracle_metadata.json');
let luckyOracleContract : ContractPromise;

const rewardManagerContractAddress = config.rewardManagerContractAddress;
const rewardManagerContractMetadata = readFileSync('./metadata/reward_manager_metadata.json');
let rewardManagerContract : ContractPromise;

const luckyRaffleContractAddress = config.luckyRaffleContractAddress;
const luckyRaffleContractMetadata = readFileSync('./metadata/lucky_raffle_metadata.json');
let luckyRaffleContract : ContractPromise;


async function initConnection(){

    const wsProvider = new WsProvider('wss://rpc.shibuya.astar.network');
    api = await ApiPromise.create({ provider: wsProvider});

    const[chain, nodeName, nodeVersion] = await Promise.all([
        api.rpc.system.chain(),
        api.rpc.system.name(),
        api.rpc.system.version()
    ]);

    console.log('You are connected to chain %s using %s v%s', chain, nodeName, nodeVersion);

    keyring = new Keyring({ type: 'sr25519'});
    worker = keyring.addFromUri(config.worker_seed);   

    dAppStakingDeveloperContract = new ContractPromise(api, dAppStakingDeveloperContractMetadata.toString(), dAppStakingDeveloperContractAddress);
    luckyOracleContract = new ContractPromise(api, luckyOracleContractMetadata.toString(), luckyOracleContractAddress);    
    rewardManagerContract = new ContractPromise(api, rewardManagerContractMetadata.toString(), rewardManagerContractAddress);    
    luckyRaffleContract = new ContractPromise(api, luckyRaffleContractMetadata.toString(), luckyRaffleContractAddress);   

}


async function checkGrants() : Promise<void>{

    console.log('----------------------------------------------------------------------------------');
    console.log('Check grants ... ');
  

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 6219235328, proofSize: 131072}
    );
    
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;  

    const ROLE_WHITELISTED = api.registry.createType('u32', 754910830);
    const ROLE_REWARD_MANAGER = api.registry.createType('u32', 3562086346);
    const ROLE_ORACLE_MANAGER = api.registry.createType('u32', 873630880);
    const ROLE_RAFFLE_MANAGER = api.registry.createType('u32', 2845312152);

    const[hasRoleWhitelisted, hasRoleRewardManager, hasRoleOracleManager, hasRoleRaffleManager] = await Promise.all([
        dAppStakingDeveloperContract.query['accessControl::hasRole'](
            worker.address, {gasLimit, storageDepositLimit}, 
            ROLE_WHITELISTED, luckyRaffleContractAddress
        ),
        rewardManagerContract.query['accessControl::hasRole'](
            worker.address, {gasLimit, storageDepositLimit}, 
            ROLE_REWARD_MANAGER, luckyRaffleContractAddress
        ),
        luckyOracleContract.query['accessControl::hasRole'](
            worker.address, {gasLimit, storageDepositLimit}, 
            ROLE_ORACLE_MANAGER, worker.address
        ),
        luckyRaffleContract.query['accessControl::hasRole'](
            worker.address, {gasLimit, storageDepositLimit}, 
            ROLE_RAFFLE_MANAGER, worker.address
        )
    ]);

    if (hasRoleWhitelisted.result.isOk){
        const hasRole = (Boolean) (hasRoleWhitelisted.output?.toPrimitive());
        if (!hasRole){
            return Promise.reject("ERROR: the raffle contract is not whitelisted in the developper contract");
        }
    } else {
        return Promise.reject("ERROR when query dAppStakingDeveloperContract.accessControl::hasRole " + hasRoleWhitelisted.result.asErr);
    }

    if (hasRoleRewardManager.result.isOk){
        const hasRole = (Boolean) (hasRoleRewardManager.output?.toPrimitive());
        if (!hasRole){
            return Promise.reject("ERROR: the raffle contract cannot push data is not the reward manager");
        }
    } else {
        return Promise.reject("ERROR when query rewardManagerContract.accessControl::hasRole " + hasRoleRewardManager.result.asErr);
    }
    
    if (hasRoleOracleManager.result.isOk){
        const hasRole = (Boolean) (hasRoleOracleManager.output?.toPrimitive());
        if (!hasRole){
            return Promise.reject("ERROR: the worker cannot set the data in the Oracle");
        }
    } else {
        return Promise.reject("ERROR when query luckyOracleContract.accessControl::hasRole " + hasRoleOracleManager.result.asErr);
    }

    if (hasRoleRaffleManager.result.isOk){
        const hasRole = (Boolean) (hasRoleRaffleManager.output?.toPrimitive());
        if (!hasRole){
            return Promise.reject("ERROR: the worker cannot start a raffle");
        }
    } else {
        return Promise.reject("ERROR when query luckyRaffleContract.accessControl::hasRole " + hasRoleRaffleManager.result.asErr);
    }
    
    console.log('Ok');
}


async function checkRaffleConfiguration() : Promise<void>{

    console.log('----------------------------------------------------------------------------------');
    console.log('Check Raffle Configuration ... ');
  

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 6219235328, proofSize: 131072}
    );
    
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;  

    const[
        getDappsStakingDeveloperAddressOutcome, 
        getLuckyOracleAddressOutcome, 
        getRewardManagerAddressOutcome,
        getTotalRatioDistributionOutcome,
        getRatioDistributionOutcome
    ] = await Promise.all([
        luckyRaffleContract.query.getDappsStakingDeveloperAddress(
            worker.address, {gasLimit, storageDepositLimit}
        ),
        luckyRaffleContract.query.getLuckyOracleAddress(
            worker.address, {gasLimit, storageDepositLimit}
        ),
        luckyRaffleContract.query.getRewardManagerAddress(
            worker.address, {gasLimit, storageDepositLimit}
        ),
        luckyRaffleContract.query['raffle::getTotalRatioDistribution'](
            worker.address, {gasLimit, storageDepositLimit}
        ),
        luckyRaffleContract.query['raffle::getRatioDistribution'](
            worker.address, {gasLimit, storageDepositLimit}
        )
    ]);

    if (getDappsStakingDeveloperAddressOutcome.result.isOk){
        const address = getDappsStakingDeveloperAddressOutcome.output?.toPrimitive()?.toString();
        if (address != dAppStakingDeveloperContractAddress){
            return Promise.reject('ERROR: ddAppStakingDeveloperContractAddress set in the raffle contract is not the same : ' + address + ' <> ' + dAppStakingDeveloperContractAddress);
        }
    } else {
        return Promise.reject('ERROR when query getDappsStakingDeveloperAddress ' + getDappsStakingDeveloperAddressOutcome.result.asErr);
    }

    if (getLuckyOracleAddressOutcome.result.isOk){
        const address = getLuckyOracleAddressOutcome.output?.toPrimitive()?.toString();
        if (address != luckyOracleContractAddress){
            return Promise.reject('ERROR: luckyOracleAddress set in the raffle contract is not the same : ' + address + ' <> ' + luckyOracleContractAddress);
        }
    } else {
        return Promise.reject('ERROR when query getDappsStakingDeveloperAddress ' + getLuckyOracleAddressOutcome.result.asErr);
    }

    if (getRewardManagerAddressOutcome.result.isOk){
        const address = getRewardManagerAddressOutcome.output?.toPrimitive()?.toString();
        if (address != rewardManagerContractAddress){
            return Promise.reject('ERROR: rewardManagerContractAddress set in the raffle contract is not the same : ' + address + ' <> ' + rewardManagerContractAddress);
        }
    } else {
        return Promise.reject('ERROR when query getDappsStakingDeveloperAddress ' + getRewardManagerAddressOutcome.result.asErr);
    }

    if (getTotalRatioDistributionOutcome.result.isOk){
        const value = (Number) (getTotalRatioDistributionOutcome.output?.toPrimitive()?.valueOf());
        if (value <= 0){
            return Promise.reject('ERROR: totalRatioDistribution is not set in the raffle contract : ' + value);
        }
    } else {
        return Promise.reject('ERROR when query getTotalRatioDistribution ' + getTotalRatioDistributionOutcome.result.asErr);
    }
    
    if (getRatioDistributionOutcome.result.isOk){
        const value = (getRatioDistributionOutcome.output?.toPrimitive()?.valueOf()) as Array<Number>;
        if (value == null || value.length == 0){
            return Promise.reject('ERROR: ratioDistribution is not set in the raffle contract : ' + value);
        }
    } else {
        return Promise.reject('ERROR when query getRatioDistribution ' + getRatioDistributionOutcome.result.asErr);
    }

    console.log('Ok');
}




type ExtrinsicResult = {
    success: boolean;
    failed: boolean;
    finalized: boolean;
}

function readResult(result: ISubmittableResult, extrinsicResult: ExtrinsicResult) : boolean {

    let r = false;
    console.log('Transaction status:', result.status.type);

    if (result.status.isInBlock || result.status.isFinalized) {
        console.log('Transaction hash ', result.txHash.toHex());
        extrinsicResult.finalized = result.status.isFinalized;

        result.events.forEach(({ phase, event : {data, method, section}} ) => {
            console.log(' %s : %s.%s:: %s', phase, section, method, data);
            if (section == 'system' && method == 'ExtrinsicSuccess'){
                extrinsicResult.success = true;
                return true;
            } else if (section == 'system' && method == 'ExtrinsicFailed'){
                extrinsicResult.failed = true;
                return true;
            }/* 
            else if (section == 'contracts' && method == 'ContractEmitted'){
                const [accountId, contractEvent] = data;
                const decodedEvent = new Abi(luckyRaffleContractMetadata.toString()).decodeEvent(contractEvent.toU8a()); 
                console.log('Contract Emmitted event = ' + decodedEvent)
            } */
        });
    } else if (result.isError){
        console.log('Error');
        extrinsicResult.failed = true;
        return true;
    }
    return false;
}


async function claimDAppStaking(
    era: Number
) : Promise<void>{

    console.log('----------------------------------------------------------------------------------');
    console.log('Claim dApp Staking ...');

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit = 30000n * 1000000n;
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

    let extrinsicResult : ExtrinsicResult = {success: false, failed: false, finalized: false }; 

    const unsub = await api.tx.dappsStaking.claimDapp(
        {wasm : dAppStakingApplicationContractAddress}, 
        era
        )
        .signAndSend(
            worker, 
            (result) => {
                if (readResult(result, extrinsicResult)) {
                    unsub();
                }
            }
        );

    do {
        // wait 10 seconds
        await setTimeout(10000);
        // until the transaction has been finalized (or failed)
    } while (!extrinsicResult.failed && !extrinsicResult.finalized);

    if (extrinsicResult.failed){
        return Promise.reject("ERROR: Extrinsic failed when claiming dAppStaking for era " + era);
    }

    console.log('Ok');
    
}

async function getRewards(
    era: Number
): Promise<BigInt> {

    console.log('----------------------------------------------------------------------------------');
    console.log('Get Rewards ... ');

    try {    
        const body = { query : 'query {developerRewards(filter: { era: { equalTo: \"' + era + '\" } }) {nodes {amount, era}}}' };

        console.log('POST %s', config.subqlUrl );
        console.log(body);

        const response = await fetch(config.subqlUrl, {
            method: 'POST', 
            headers: {
                'Content-Type' : 'application/json',
                'Accept' : 'application/json'
            },
            body: JSON.stringify(body)
        });

        console.log('Response status: %s', response.statusText);        
        const data = await response.text();
        console.log(data);

        const rewards = JSON.parse(data).data.developerRewards.nodes[0].amount;
        console.log('OK, Rewards: %s', rewards);
        
        return BigInt(rewards);

    } catch(error) {
        console.log("Error when getting rewards : " + error);
        return Promise.reject(error);
    }

}

type Participant = {
    address: string;
    stake: BigInt;
}

interface GetParticipantsQueryResult {
    sum: { amount : string };
    keys: string[];
}

async function getParticipants(
    era: Number
): Promise<Participant[]> {

    console.log('----------------------------------------------------------------------------------');
    console.log('Get Participants ... ');

    try {    
        const body = { query : 'query {stakes(filter: { era: { lessThanOrEqualTo: \"' + era + '\" }}) {groupedAggregates(groupBy: [ACCOUNT_ID], having: { sum: { amount: { notEqualTo: "0" }}}) { sum{amount}, keys }}}' };

        console.log('POST %s', config.subqlUrl );
        console.log(body);

        const response = await fetch(config.subqlUrl, {
            method: 'POST', 
            headers: {
                'Content-Type' : 'application/json',
                'Accept' : 'application/json'
            },
            body: JSON.stringify(body)
        });

        console.log('Response status: %s', response.statusText);        
        const data = await response.text();
        console.log(data);

        var participants: Participant[] = [];

        var participantsQueryResult : Array<GetParticipantsQueryResult> = JSON.parse(data).data.stakes.groupedAggregates;

        for(let i=0; i<participantsQueryResult.length; i++){

            const address = participantsQueryResult[i].keys[0];
            console.log('address: %s', address);

            console.log('stake: %s', participantsQueryResult[i].sum);

            //const stake = BigInt(participantsQueryResult[i].sum.amount);
            const stake = BigInt(10);            
            console.log('stake: %s', stake.valueOf());
            
            participants.push({address, stake});
        }
        
        console.log('Ok');
        return participants;

    } catch(error) {
        console.log("Error when getting participants : " + error);
        return Promise.reject(error);
    }
}

async function setRewards(
    era: Number,
    value: BigInt
) : Promise<void>{

    console.log('----------------------------------------------------------------------------------');
    console.log('Set rewards ... ');

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 6219235328, proofSize: 131072}
    );
    
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

    const rewards: Balance = api.registry.createType('Balance', value);

    let extrinsicResult : ExtrinsicResult = {success: false, failed: false, finalized: false }; 

    const unsub = await luckyOracleContract.tx['oracleDataManager::setRewards'](
        { gasLimit, storageDepositLimit }, 
        era, rewards
        )
        .signAndSend(
            worker, 
            (result) => {
                if (readResult(result, extrinsicResult)) {
                    unsub();
                }
            }
        );

    do {
        // wait 10 seconds
        await setTimeout(10000);
        // until the transaction has been finalized (or failed)
    } while (!extrinsicResult.failed && !extrinsicResult.finalized);

    if (extrinsicResult.failed){
        return Promise.reject("ERROR: Extrinsic failed when claiming dAppStaking for era " + era);
    }
    console.log('Ok');
}

async function setParticipants(
    era: Number,
    participants: Participant[],
) : Promise<void>{

    console.log('----------------------------------------------------------------------------------');
    console.log('Set participants ...');

    if  (participants.length == 0) {
        console.log("ERROR: There is no participant for era %s", era);
        return Promise.reject("ERROR: There is no participant for era " + era);
    }

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 6219235328, proofSize: 131072}
    );
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

    let args = participants.map( p => (
        api.registry.createType('AccountId', p.address), 
        api.registry.createType('Balance', p.stake)
    ));

    let extrinsicResult : ExtrinsicResult = {success: false, failed: false, finalized: false }; 

    const unsub = await luckyOracleContract.tx['oracleDataManager::addParticipants'](
        { storageDepositLimit, gasLimit }, 
        era, args
        )
        .signAndSend(
            worker, 
            (result) => {
                if (readResult(result, extrinsicResult)) {
                    unsub();
                }
            }
        );

    do {
        // wait 10 seconds
        await setTimeout(10000);
        // until the transaction has been finalized (or failed)
    } while (!extrinsicResult.failed && !extrinsicResult.finalized);

    if (extrinsicResult.failed){
        return Promise.reject("ERROR: Extrinsic failed when claiming dAppStaking for era " + era);
    }
    console.log('Ok');
}

async function runRaffle(era: Number) : Promise<void>{

    console.log('----------------------------------------------------------------------------------');
    console.log('Run Raffle ...');
    
    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 30000000000, proofSize: 300000}
    );
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

    let extrinsicResult : ExtrinsicResult = {success: false, failed: false, finalized: false }; 

    const unsub = await luckyRaffleContract.tx
        .runRaffle({ storageDepositLimit, gasLimit }, era)
        .signAndSend(
            worker, 
            (result) => {
                if (readResult(result, extrinsicResult)) {
                    unsub();
                }
            }
        );

    do {
        // wait 10 seconds
        await setTimeout(10000);
        // until the transaction has been finalized (or failed)
    } while (!extrinsicResult.failed && !extrinsicResult.finalized);

    if (extrinsicResult.failed){
        return Promise.reject("ERROR: Extrinsic failed when claiming dAppStaking for era " + era);
    }
    console.log('Ok');
}


async function getEraLastRaffleDone() : Promise<Number>{

    console.log('----------------------------------------------------------------------------------');
    console.log('Get era for the last raffle done ... ');
        
    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 6219235328, proofSize: 131072}
    );
    
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;
  
    const {result, output} = await luckyRaffleContract.query['raffle::getLastEraDone'](worker.address, {gasLimit, storageDepositLimit});

    if (result.isOk){
        return (Number) (output?.toPrimitive());
    }
    return Promise.reject("ERROR when query raffle::getLastEraDone " + result.asErr);
}


async function run(era: Number) : Promise<void>{
               
    return claimDAppStaking(era).then(
        () => getRewards(era).catch(
            () => setTimeout(30000)
                .then(() => getRewards(era))
                .catch(
                    () => setTimeout(30000)
                    .then( () => getRewards(era))
                )
            )// try it 3 times
    ).then (
        (rewards) => setRewards(era, rewards)
    ).then (
        () => getParticipants(era)
    ).then (
        (participants) => setParticipants(era, participants)
    ).then (
        () => runRaffle(era).catch(
            () => setTimeout(30000)
                .then(() => runRaffle(era))
                .catch(
                    () => setTimeout(30000)
                    .then( () => runRaffle(era))
                )
            )// try it 3 times
    ).then (
    );

}

async function runAllEra() : Promise<void>{

    await initConnection();

    await checkGrants();

    await checkRaffleConfiguration();

    const lastEraDone = await getEraLastRaffleDone();
    console.log('Last era when we run the raffle: %s', lastEraDone);

    const currentEra = (Number) ((await api.query.dappsStaking.currentEra()).toPrimitive());
    console.log('Current era for dApp staking: %s', currentEra);

    let era: number;
    if (lastEraDone == 0){
        era = currentEra - 1;
    } else {
        era = lastEraDone.valueOf() + 1;
    }

    while (era < currentEra){

        console.log('----------------------------------------------------------------------------------');
        console.log("                     Start raffle for era %s", era);

        await run(era).then( 
            () => {
                console.log("Raffle succesfully run for era %s", era);
                era += 1;
            }
        ).catch( (error) => {
            console.log("Raffle failed for era %s", era);
            console.log(error);
            return Promise.reject(error);
        });

    }
}


runAllEra().catch(console.error).finally(() => process.exit());
