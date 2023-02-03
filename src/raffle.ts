import { WeightV2 } from '@polkadot/types/interfaces';
import { 
    api, worker, signAndSend, 
    luckyRaffleContract, dAppStakingDeveloperContractAddress, 
    luckyOracleContractAddress, rewardManagerContractAddress
} from './txHelper';


export async function checkRaffleConfiguration() : Promise<void>{

    console.log('Check Raffle Configuration ... ');
  
    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 30000000000, proofSize: 1000000}
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
        const output : string = getDappsStakingDeveloperAddressOutcome.output?.toString() ?? '';
        const address = JSON.parse(output).ok;
        console.log('DAppStakingDeveloperContractAddress: %s', address);
        if (address != dAppStakingDeveloperContractAddress){
            return Promise.reject('ERROR: dAppStakingDeveloperContractAddress set in the raffle contract is not the same : ' + address + ' <> ' + dAppStakingDeveloperContractAddress);
        }
    } else {
        return Promise.reject('ERROR when query getDappsStakingDeveloperAddress ' + getDappsStakingDeveloperAddressOutcome.result.asErr);
    }

    if (getLuckyOracleAddressOutcome.result.isOk){
        const output : string = getLuckyOracleAddressOutcome.output?.toString() ?? '';
        const address = JSON.parse(output).ok;
        console.log('LuckyOracleAddress: %s', address);
        if (address != luckyOracleContractAddress){
            return Promise.reject('ERROR: luckyOracleAddress set in the raffle contract is not the same : ' + address + ' <> ' + luckyOracleContractAddress);
        }
    } else {
        return Promise.reject('ERROR when query getDappsStakingDeveloperAddress ' + getLuckyOracleAddressOutcome.result.asErr);
    }

    if (getRewardManagerAddressOutcome.result.isOk){
        const output : string = getRewardManagerAddressOutcome.output?.toString() ?? '';
        const address = JSON.parse(output).ok;
        console.log('RewardManagerContractAddress: %s', address);
        if (address != rewardManagerContractAddress){
            return Promise.reject('ERROR: rewardManagerContractAddress set in the raffle contract is not the same : ' + address + ' <> ' + rewardManagerContractAddress);
        }
    } else {
        return Promise.reject('ERROR when query getDappsStakingDeveloperAddress ' + getRewardManagerAddressOutcome.result.asErr);
    }

    if (getTotalRatioDistributionOutcome.result.isOk){
        const output : string = getTotalRatioDistributionOutcome.output?.toString() ?? '';
        const value = JSON.parse(output).ok;
        console.log('Total ratio distribution: %s', value);
        if (value <= 0){
            return Promise.reject('ERROR: totalRatioDistribution is not set in the raffle contract : ' + value);
        }
    } else {
        return Promise.reject('ERROR when query getTotalRatioDistribution ' + getTotalRatioDistributionOutcome.result.asErr);
    }
    
    if (getRatioDistributionOutcome.result.isOk){
        const output : string = getRatioDistributionOutcome.output?.toString() ?? '';
        const value = JSON.parse(output).ok as Array<Number>;
        console.log('Ratio distribution: %s', value);
        if (value == null || value.length == 0){
            return Promise.reject('ERROR: ratioDistribution is not set in the raffle contract : ' + value);
        }
    } else {
        return Promise.reject('ERROR when query getRatioDistribution ' + getRatioDistributionOutcome.result.asErr);
    }

    console.log('Check configuration Ok');
}

export async function getLastEraRaffleDone() : Promise<Number>{
       
    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2',
        {refTime: 30000000000, proofSize: 1000000}
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


export async function runRaffle(era: Number) : Promise<void>{

    console.log('Run raffle for era %s', era);

    // maximum gas to be consumed for the call. if limit is too small the call will fail.
    const gasLimit: WeightV2 = api.registry.createType('WeightV2', 
        {refTime: 30000000000, proofSize: 1000000}
    );
    // a limit to how much Balance to be used to pay for the storage created by the contract call
    // if null is passed, unlimited balance can be used
    const storageDepositLimit = null;

    const tx = luckyRaffleContract.tx.runRaffle({ storageDepositLimit, gasLimit }, era);

    await signAndSend(tx);

    console.log('Raffle done');
}