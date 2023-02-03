import { WeightV2 } from '@polkadot/types/interfaces';
import { 
    api, 
    worker, 
    dAppStakingDeveloperContract, 
    rewardManagerContract, 
    luckyOracleContract, 
    luckyRaffleContract,
    luckyRaffleContractAddress 
} from './txHelper';

export async function checkGrants() : Promise<void>{

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
