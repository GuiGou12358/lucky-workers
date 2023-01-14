import { ApiPromise, WsProvider, Keyring} from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { ContractPromise } from '@polkadot/api-contract';
import { readFileSync, promises as fsPromises } from 'fs';
import type { ISubmittableResult} from '@polkadot/types/types';
import { setTimeout } from 'timers/promises';
import { AccountId, Balance, WeightV2 } from '@polkadot/types/interfaces';
import fetch from 'node-fetch';
//import { queryJSON, queryOkJSON, handleReturnType, handleEventReturn, QueryReturnType, GasLimit, GasLimitAndValue } from '@supercolony/typechain-types';

let api : ApiPromise;
let keyring : Keyring;

// shibuya: Xe8UnmtLFiXqEPpfiWpiRVpZm37XidF7mK6sFU735C8gzn5
let luckyOracleContractAddress = 'WcSwaf6V3BJEUDqMS3XmPvWg6fr2feQyCyPE7d3uybmTc9g';
let luckyOracleContract : ContractPromise;

// shibuya: WQSTY3TppxoifFPNhdiiDikdmuiEKhg5wRpt8UzxZN3b8VA
let luckyRaffleContractAddress = 'WEgn5eoQyxx8XbBjvbLYMLLPyyjhHR9NSBDNDYRcyeTXZHi';
let luckyRaffleContract : ContractPromise;

// shibuya
let dAppStakingContractAddress = 'bc3yCAej7WxPBi4x1Ba1zru9HtieZrW7jk15QmGWSwZ7D6G';

let worker : KeyringPair;


function readResult(result: ISubmittableResult) : boolean {

    let r = false;
    console.log('Transaction status:', result.status.type);

    if (result.status.isInBlock || result.status.isFinalized) {
        console.log('Transaction hash ', result.txHash.toHex());

        result.events.forEach(({ phase, event : {data, method, section}} ) => {
            console.log(' %s : %s.%s:: %s', phase, section, method, data);
            if (section == 'system' && method == 'ExtrinsicSuccess'){
                console.log('Success');
                return true;
            } else if (section == 'system' && method == 'ExtrinsicFailed'){
                console.log('Failed');
                return true;
            }
        });
    } else if (result.isError){
        console.log('Error');
        return true;
    }
    return false;
}



function begin(name: string) {
    console.log('[BEGINNING] ---- %s -----------------------------------------', name);
}

function end(name: string) {
    console.log('[END] ---- %s -----------------------------------------------', name);
}


async function claimDAppStaking(
    era: Number
) : Promise<void>{

    begin('Claim dApp Staking');

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit = 30000n * 1000000n;
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;



    const unsub = await api.tx.dappsStaking.claimDapp(
        {wasm : dAppStakingContractAddress}, 
        era
        )
        .signAndSend(
            worker, 
            (result) => {
                if (readResult(result)) {
                    unsub();
                }
            }
        );

        console.log('A0')
/*
        await api.tx.dappsStaking.claimDapp(
            {wasm : dAppStakingContractAddress}, 
            era
            )
            .signAndSend(
                worker, 
                (result) => {
                    console.log('b1');
                    if (readResult(result)) {
                        //unsub();
                    console.log('b2');
                    }
                    console.log('b3');
                }
            ).then(
                () => console.log('A1')
            );

            console.log('A2')
            */

    // wait 60 seconds
    await setTimeout(60000);
    
}

type Participant = {
    address: string;
    stake: BigInt;
}


interface GetParticipantsQueryResult {
    sum: { amount : string };
    keys: string[];
}

async function getRewards(
    era: Number
): Promise<BigInt> {

    begin('Get Rewards');

    const url = 'http://localhost:3000/';

    try {    
        const body = { query : 'query {developerRewards(filter: { era: { equalTo: \"' + era + '\" } }) {nodes {amount, era}}}' };

        console.log('POST %s', url );
        console.log(body);

        const response = await fetch(url, {
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
        console.log('Rewards: %s', rewards);
        
        return BigInt(rewards);

    } catch(error) {
        console.log(error);
        return BigInt(0);
    }


}



async function getParticipants(
    era: Number
): Promise<Participant[]> {

    begin('Get Participants');

    var participants: Participant[] = [];

    const url = 'http://localhost:3000/';

    try {    
        const body = { query : 'query {stakes(filter: { era: { lessThanOrEqualTo: \"' + era + '\" }}) {groupedAggregates(groupBy: [ACCOUNT_ID], having: { sum: { amount: { notEqualTo: "0" }}}) { sum{amount}, keys }}}' };

        console.log('POST %s', url );
        console.log(body);

        const response = await fetch(url, {
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

        var participantsQueryResult : Array<GetParticipantsQueryResult> = JSON.parse(data).data.stakes.groupedAggregates;

        for(let i=0; i<participantsQueryResult.length; i++){

            const address = participantsQueryResult[i].keys[0];
            console.log('address: %s', address);

            console.log('stake: %s', participantsQueryResult[i].sum);

            //const stake = BigInt(participantsQueryResult[i].sum.amount);
            const stake = BigInt(1);            
            console.log('stake: %s', stake);
            
            participants.push({address, stake});
        }
        
    } catch(error) {
        console.log(error);
    }

    return participants;
}




async function setParticipants(
    era: Number,
    participants: Participant[],
) : Promise<void>{

    begin('Set participants');

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

    const unsub = await luckyOracleContract.tx['oracleDataManager::addParticipants'](
        { storageDepositLimit, gasLimit }, 
        era, args
        )
        .signAndSend(
            worker, 
            (result) => {
                if (readResult(result)) {
                    unsub();
                }
            }
        );

    // wait 60 seconds
    await setTimeout(60000);
}

async function setRewards(
    era: Number,
    value: BigInt
) : Promise<void>{

    begin('Set rewards');

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 6219235328, proofSize: 131072}
    );
    
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

    const rewards: Balance = api.registry.createType('Balance', value);

    const unsub = await luckyOracleContract.tx['oracleDataManager::setRewards'](
        { gasLimit, storageDepositLimit }, 
        era, rewards
        )
        .signAndSend(
            worker, 
            (result) => {
                if (readResult(result)) {
                    unsub();
                }
            }
        );

    // wait 60 seconds
    await setTimeout(60000);
}



async function runRaffle(era: Number) : Promise<void>{

    begin('Run Raffle');
    
    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 30000000000, proofSize: 247867}
    );
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

    const unsub = await luckyRaffleContract.tx
        .runRaffle({ storageDepositLimit, gasLimit }, era)
        .signAndSend(
            worker, 
            (result) => {
                if (readResult(result)) {
                    unsub();
                }
            }
        );

    // wait 60 seconds
    await setTimeout(60000);
}


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
    //worker = keyring.addFromUri('element ...audit', {name: 'Test 0'}); 

    const luckyOracleContractMetadata = readFileSync('./metadata/lucky_oracle_metadata.json');
    luckyOracleContract = new ContractPromise(api, luckyOracleContractMetadata.toString(), luckyOracleContractAddress);

    const luckyRaffleContractMetadata = readFileSync('./metadata/lucky_raffle_metadata.json');
    luckyRaffleContract = new ContractPromise(api, luckyRaffleContractMetadata.toString(), luckyRaffleContractAddress);
   

}


async function run(era: Number){
           
    await claimDAppStaking(era).then( 
        () => getRewards(era)
    ).then (
        (rewards) => setRewards(era, rewards)
    ).then (
        () => getParticipants(era)
    ).then (
        (participants) => setParticipants(era, participants)
    ).then (
        () => runRaffle(era)
    );

    /*
    var rewards : BigInt;
    var i = 0;

    do {
        // wait 5 seconds to have time to listen events in subql
        await setTimeout(5000);
        rewards = await getRewards(era);
        if (rewards.valueOf() <= 0 && i++ > 5){
            console.log('No rewards => STOP era %s', era);
            return;
        }
    } while (rewards.valueOf() <= 0);

    await setRewards(era, rewards);
    await setTimeout(5000);

    const participants = await getParticipants(era);
    await setParticipants(era, participants);

    await setTimeout(5000);
    await runRaffle(era);
    
*/
}


async function runForAllEra() : Promise<void>{

    await initConnection();

    const currentEra = 2090; // TODO

    const targetEra = (Number) ((await api.query.dappsStaking.currentEra()).toPrimitive());

    console.log('current era dAppStaking %s', targetEra);

    await run(currentEra);

}





runForAllEra().catch(console.error).finally(() => process.exit());
