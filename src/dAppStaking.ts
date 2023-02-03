import { api, dAppStakingApplicationContractAddress, signAndSend } from './txHelper';


export async function getCurrentEra() : Promise<Number>{
    const currentEra = (Number) ((await api.query.dappsStaking.currentEra()).toPrimitive());
    console.log('Current era for dApp staking: %s', currentEra);
    return currentEra;
}

export async function claimDAppStaking(
    era: Number
) : Promise<void>{

    console.log('Claim dApp Staking ...');

    const tx = api.tx.dappsStaking.claimDapp(
        {wasm : dAppStakingApplicationContractAddress}, 
        era
    );

    await signAndSend(tx);

    console.log('Claim dApp Staking  Ok');    
}
