import { KeyringPair } from '@polkadot/keyring/types';
import { ApiPromise, WsProvider, Keyring} from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import type { ISubmittableResult} from '@polkadot/types/types';
import { setTimeout } from 'timers/promises';
import { readFileSync } from 'fs';
import { config } from './config';
import { isDebug } from './luckyCli';
import { SubmittableExtrinsic } from '@polkadot/api/types';

export let api : ApiPromise;
export let keyring : Keyring;
export let worker : KeyringPair;

export const dAppStakingApplicationContractAddress = config.dAppStakingApplicationContractAddress;
export const dAppStakingDeveloperContractAddress = config.dAppStakingDeveloperContractAddress;
const dAppStakingDeveloperContractMetadata = readFileSync('./metadata/dapps_staking_developer_metadata.json');
export let dAppStakingDeveloperContract : ContractPromise;

export const luckyOracleContractAddress = config.luckyOracleContractAddress;
const luckyOracleContractMetadata = readFileSync('./metadata/lucky_oracle_metadata.json');
export let luckyOracleContract : ContractPromise;

export const rewardManagerContractAddress = config.rewardManagerContractAddress;
const rewardManagerContractMetadata = readFileSync('./metadata/reward_manager_metadata.json');
export let rewardManagerContract : ContractPromise;

export const luckyRaffleContractAddress = config.luckyRaffleContractAddress;
const luckyRaffleContractMetadata = readFileSync('./metadata/lucky_raffle_metadata.json');
export let luckyRaffleContract : ContractPromise;


export async function initConnection(){

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

export async function signAndSend(
    extrinsic: SubmittableExtrinsic<'promise', ISubmittableResult>
) : Promise<void> {

    let extrinsicResult : ExtrinsicResult = {success: false, failed: false, finalized: false }; 

/*
    if (extrinsic.hasDryRun){
        const {isErr, asErr} = await extrinsic.dryRun(worker);
        if (isErr){
            console.log('result : %s', asErr.toHuman());
            return Promise.reject("ERROR when dry run " + asErr.toHuman());
        }
    }
*/

    const unsub = await extrinsic.signAndSend(
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
        return Promise.reject("ERROR: Extrinsic failed");
    }

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
            if (isDebug()){
                console.log(' %s : %s.%s:: %s', phase, section, method, data);
            }
            if (section == 'system' && method == 'ExtrinsicSuccess'){
                extrinsicResult.success = true;
                return true;
            } else if (section == 'system' && method == 'ExtrinsicFailed'){
                extrinsicResult.failed = true;
                if (isDebug()){
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
