import { KeyringPair } from '@polkadot/keyring/types';
import { ApiPromise, WsProvider, Keyring} from '@polkadot/api';
import { ContractPromise, Abi } from '@polkadot/api-contract';
import type { ISubmittableResult} from '@polkadot/types/types';
import { Balance, WeightV2 } from '@polkadot/types/interfaces';
import { setTimeout } from 'timers/promises';
import { readFileSync } from 'fs';
import yargs from 'yargs/yargs';
import fetch from 'node-fetch';
import {Config} from './config';

const argv = yargs(process.argv.slice(2)).options({
    ce: {alias: 'currentEra', desc: 'Display the current era for dApp staking'},
    lrr: {alias: 'lastEraReceivedReward', desc: 'Display the last era when the dapp received rewards from dApp staking'},
    lrd: {alias: 'lastEraRaffleDone', desc: 'Display the last era when the raffle has been run'},
    dc: {alias: 'displayConfiguration', desc: 'Diplay the configuration (contract and http addresses)'},
    ch: {alias: 'checks', desc: 'Check if the grants and the configuration in the smart contracts have been set'},
    cl: {alias: 'claim', desc: 'Claim dappStaking developer rewards for a given era - era is mandatory'},
    so: {alias: 'setOracle', desc: 'Set Oracle data for a given era - era is mandatory'},
    r:  {alias: 'raffle', desc: 'Start the raffle for a given era - era is mandatory'},
    a:  {alias: 'all', desc: 'Equivalent to --checks --claim --setOracle --raffle for a given era or for for all era (from --lastEra to --currentEra) if no era is provided'},
    era: {type: 'number', desc: 'Given era'},
    d: {alias: 'debug', desc: 'Debug mode: display more information'},
}).version('0.1').parseSync();

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

async function displayConfiguration(){
    console.log('RPC: %s', config.rpc);
    console.log('dAppStaking application contract address: %s', dAppStakingApplicationContractAddress);
    console.log('dAppStaking developer contract address: %s', config.dAppStakingDeveloperContractAddress);
    console.log('lucky oracle contract address: %s', luckyOracleContractAddress);
    console.log('reward manager contract address: %s', rewardManagerContractAddress);
    console.log('raffle contract address: %s', luckyRaffleContractAddress);
    console.log('subQL url: %s', config.subqlUrl);
}

async function initConnection(){

    const wsProvider = new WsProvider(config.rpc);
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
    
    console.log('Check grants Ok');
}


async function checkRaffleConfiguration() : Promise<void>{

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

    console.log('Check configuration Ok');
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

        //result.events.forEach(({ phase, event : {data, method, section}} ) => {
        result.events.forEach(({ phase, event} ) => {
            let data = event.data;
            let method = event.method;
            let section = event.section;
            if (argv.debug){
                console.log(' %s : %s.%s:: %s', phase, section, method, data);
            }
            if (section == 'system' && method == 'ExtrinsicSuccess'){
                extrinsicResult.success = true;
                return true;
            } else if (section == 'system' && method == 'ExtrinsicFailed'){
                extrinsicResult.failed = true;
                if (!argv.debug){
                    console.log(' %s : %s.%s:: %s', phase, section, method, data);
                }
                /*                
                console.log(data.toHuman());
                const [accountId, contractEvent] = data;      
                console.log(contractEvent.toHuman());
                */
                return true;
            } /*else if (section == 'contracts' && method == 'ContractEmitted'){
                const [accountId, contractEvent] = data;
                const decodedEvent = new Abi(luckyRaffleContractMetadata.toString()).decodeEvent(contractEvent.toU8a()); 
                console.log('Contract Emmitted event = ' + decodedEvent)
            }*/
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

    console.log('Claim dApp Staking  Ok');
    
}


async function getLastEraReceivedReward(): Promise<Number> {

    console.log('Get last era when the dApp received the rewards ... ');

    try {    
        const body = { query : 'query {developerRewards(orderBy: ERA_DESC, first:1) {nodes {era}}}' };

        if (argv.debug){
            console.log('POST %s', config.subqlUrl );
            console.log(body);
        }

        const response = await fetch(config.subqlUrl, {
            method: 'POST', 
            headers: {
                'Content-Type' : 'application/json',
                'Accept' : 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (argv.debug){
            console.log('Response status: %s', response.statusText);
        }        

        const data = await response.text();

        if (argv.debug){
            console.log(data);
        }

        const era = JSON.parse(data).data.developerRewards.nodes[0].era;        
        console.log('Last era when the dApp received the rewards: %s', era);
        return era;

    } catch(error) {
        console.log("Error when getting last era when the dapp received some rewards : %s", error);
        return Promise.reject(error);
    }

}


async function getRewards(
    era: Number
): Promise<BigInt> {

    console.log('Get rewards for era %s in the indexer ...', era);

    try {    
        const body = { query : 'query {developerRewards(filter: { era: { equalTo: \"' + era + '\" } }) {nodes {amount, era}}}' };

        if (argv.debug){
            console.log('POST %s', config.subqlUrl );
            console.log(body);
        }

        const response = await fetch(config.subqlUrl, {
            method: 'POST', 
            headers: {
                'Content-Type' : 'application/json',
                'Accept' : 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (argv.debug){
            console.log('Response status: %s', response.statusText);        
        }

        const data = await response.text();

        if (argv.debug){
            console.log(data);
        }

        const rewards = JSON.parse(data).data.developerRewards.nodes[0].amount;
        console.log('Rewards: %s', rewards);
        
        return BigInt(rewards);

    } catch(error) {
        console.log("Error when getting rewards: %s", error);
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

    console.log('Get participants for era %s in the indexer ...', era);

    try {    
        const body = { query : 'query {stakes(filter: { era: { lessThanOrEqualTo: \"' + era + '\" }}) {groupedAggregates(groupBy: [ACCOUNT_ID], having: { sum: { amount: { notEqualTo: "0" }}}) { sum{amount}, keys }}}' };

        if (argv.debug){
            console.log('POST %s', config.subqlUrl );
            console.log(body);
        }

        const response = await fetch(config.subqlUrl, {
            method: 'POST', 
            headers: {
                'Content-Type' : 'application/json',
                'Accept' : 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (argv.debug){
            console.log('Response status: %s', response.statusText);        
        }

        const data = await response.text();
        
        if (argv.debug){
            console.log(data);
        }

        var participants: Participant[] = [];

        var participantsQueryResult : Array<GetParticipantsQueryResult> = JSON.parse(data).data.stakes.groupedAggregates;

        for(let i=0; i<participantsQueryResult.length; i++){

            const address = participantsQueryResult[i].keys[0];

            if (argv.debug){
                console.log('address: %s', address);
                console.log('stake: %s', participantsQueryResult[i].sum);
            }

            // Fixme
            //const stake = BigInt(participantsQueryResult[i].sum.amount);
            const stake = BigInt(10);            
            //console.log('stake: %s', stake.valueOf());
            
            participants.push({address, stake});
        }
        
        console.log('Number of participants: %s', participants.length);
        return participants;

    } catch(error) {
        console.log("Error when getting participants: %s", error);
        return Promise.reject(error);
    }
}

async function setRewards(
    era: Number,
    value: BigInt
) : Promise<void>{

    console.log('Set the rewards for era %s in the Oracle ... ', era);

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
        return Promise.reject("ERROR: Extrinsic failed when setting rewards for era " + era);
    }
    console.log('Rewards set in the Oracle');
}

async function setParticipants(
    era: Number,
    participants: Participant[],
) : Promise<void>{

    console.log('Set the participants for era %s in the Oracle ... ', era);

    if  (participants.length == 0) {
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
        return Promise.reject("ERROR: Extrinsic failed when setting participants for era " + era);
    }
    console.log('Participants set in the Oracle');
}

async function runRaffle(era: Number) : Promise<void>{

    console.log('Run raffle for era %s', era);
    
    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 30000000000, proofSize: 300000}
    );
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

     const {gasRequired, storageDeposit, result, output, debugMessage} = await luckyRaffleContract.query
        .runRaffle(worker.address, {storageDepositLimit, gasLimit}, era);

    if (argv.debug){
        console.log('result : %s', result.toHuman());
        console.log('output : %s', output?.toHuman());
        console.log('debugMessage : %s', debugMessage.toHuman());
        console.log('gasRequired : %s - storageDeposit : %s', gasRequired.toHuman(), storageDeposit.toHuman());
    }
        
    if (result.isErr){
        console.log('result : %s', result.toHuman());
        return Promise.reject("ERROR when dry run the raffle for era " + era);
    }

    if (output != null){
        console.log('output : %s', output?.toHuman());
        return Promise.reject("ERROR when dry run the raffle for era " + era);
    }

    let extrinsicResult : ExtrinsicResult = {success: false, failed: false, finalized: false }; 

    const unsub = await luckyRaffleContract.tx
        .runRaffle({ storageDepositLimit, gasLimit: gasRequired }, era)
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
        return Promise.reject("ERROR: Extrinsic failed when running raffle for era " + era);
    }
    console.log('Raffle done');
}

async function getCurrentEra() : Promise<Number>{
    const currentEra = (Number) ((await api.query.dappsStaking.currentEra()).toPrimitive());
    console.log('Current era for dApp staking: %s', currentEra);
    return currentEra;
}

async function getLastEraRaffleDone() : Promise<Number>{
       
    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 6219235328, proofSize: 131072}
    );
    
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;
  
    const {result, output} = await luckyRaffleContract.query['raffle::getLastEraDone'](worker.address, {gasLimit, storageDepositLimit});

    if (result.isOk){
        const era = (Number) (output?.toPrimitive());
        console.log('Last era when we run the raffle: %s', era);
        return era;
    }
    return Promise.reject("ERROR when query raffle::getLastEraDone " + result.asErr);
}


async function start(era: Number) : Promise<void>{
    console.log("Start era %s", era);
}


async function run(era: Number) : Promise<void>{
             
    let promise = start(era);

    if (argv.claim || argv.all){
        promise = promise.then(() => claimDAppStaking(era));
    }

    if (argv.setOracle || argv.all){
        promise = promise.then(() => 
            getRewards(era).catch(
                () => setTimeout(30000)
                .then(() => getRewards(era))
                .catch( 
                    () => setTimeout(30000)
                    .then( () => getRewards(era))
                )
            ) // try it 3 times because it can be a while for indexing data 
        ).then (
            (rewards) => setRewards(era, rewards)
        ).then (
            () => getParticipants(era)
        ).then (
            (participants) => setParticipants(era, participants)
        );
    }

    if (argv.raffle || argv.all){
        promise = promise.then(() => runRaffle(era));
    }

    return promise.then(() => console.log("End era %s", era) );
}


async function runAllEra() : Promise<void>{

    const lastEraReceivedReward = await getLastEraReceivedReward();
    const lastEraRaffleDone = await getLastEraRaffleDone();
    const currentEra = await getCurrentEra();

    if (lastEraReceivedReward != lastEraRaffleDone){
        return Promise.reject("There is a gap between the last era when the rewards have been received and when the last reffle done. Manual intervention is need.");
    }

    if (lastEraRaffleDone == 0){
        return Promise.reject("First iteration must be manual with setting explicitely the era");
    }

    let era: number = lastEraRaffleDone.valueOf() + 1;

    while (era < currentEra){

        await run(era).then( 
            () => {
                console.log("Raffle succesfully run for era %s", era);
                era += 1;
            }
        ).catch( (error) => {
            console.log("Raffle failed for era %s", era);
            return Promise.reject(error);
        });

    }
}



async function runCommands() : Promise<void>{

    if (!argv.displayConfiguration 
        && !argv.currentEra && !argv.lastEraReceivedReward && !argv.lastEraRaffleDone
        && !argv.checks && !argv.claim && !argv.setOracle && !argv.raffle && !argv.all 
        ) {
        return Promise.reject('At least one option is required. Use --help for more information');
    }

    if ((argv.claim || argv.setOracle || argv.raffle) && argv.era == undefined) {
        return Promise.reject('A given era is required for options --claim --setOracle --raffle. Use --help for more information');
    }

    if (argv.displayConfiguration) {
        displayConfiguration();
    }

    if (argv.lastEraRaffleDone || argv.currentEra
        || argv.checks || argv.claim || argv.setOracle || argv.raffle || argv.all 
        ) {
        await initConnection();
    }
    
    if (argv.checks || argv.all) {
        await checkGrants();
        await checkRaffleConfiguration();
    }

    if (argv.currentEra) {
        await getCurrentEra();
    }

    if (argv.lastEraReceivedReward) {
        await getLastEraReceivedReward();
    }
    
    if (argv.lastEraRaffleDone) {
        await getLastEraRaffleDone();
    }


    if (argv.claim || argv.setOracle || argv.raffle || argv.all) {

        if (argv.era == undefined) {
            await runAllEra();
        } else {
            await run(argv.era);
        }

    }
}


runCommands().catch(console.error).finally(() => process.exit());


