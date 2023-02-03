import { WeightV2, Balance } from '@polkadot/types/interfaces';
import { api, signAndSend, luckyOracleContract } from './txHelper';
import { Participant } from './queryIndexer';


export async function setRewards(
    era: Number,
    value: BigInt
) : Promise<void>{

    console.log('Set the rewards for era %s in the Oracle ... ', era);

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 10000000000, proofSize: 100000}
    );
    
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

    const rewards: Balance = api.registry.createType('Balance', value);

    const tx = await luckyOracleContract.tx['oracleDataManager::setRewards'](
        { gasLimit, storageDepositLimit }, 
        era, rewards
        );
    await signAndSend(tx);

    console.log('Rewards set in the Oracle');
}


export async function setParticipants(
    era: Number,
    participants: Participant[],
) : Promise<void>{

    console.log('Set the participants for era %s in the Oracle ... ', era);

    if  (participants.length == 0) {
        return Promise.reject("ERROR: There is no participant for era " + era);
    }

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 10000000000, proofSize: 100000}
    );
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

    let args = participants.map( p => (
        api.registry.createType('AccountId', p.address), 
        api.registry.createType('Balance', p.stake)
    ));

    const tx = luckyOracleContract.tx['oracleDataManager::addParticipants'](
        { storageDepositLimit, gasLimit }, 
        era, args
        );

    await signAndSend(tx);

    console.log('Participants set in the Oracle');
}
