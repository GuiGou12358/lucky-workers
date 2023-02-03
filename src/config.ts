
class Config {

    // shibuya: wss://rpc.shibuya.astar.network
    // shiden: 
    // astar: 
    rpc = 'wss://rpc.shibuya.astar.network';

    // shibuya: bfH3CKzo3yDNDgo7EVD3uTFnoAj5fDY9NyCMpZg23VJfhNW
    // shiden: 
    // astar: 
    dAppStakingApplicationContractAddress = 'bfH3CKzo3yDNDgo7EVD3uTFnoAj5fDY9NyCMpZg23VJfhNW';

    // shibuya: ZowLuDSzzxNMsVT6Ys3yRQ92p4WWUv8TVcowB2QTpg172cg
    // shiden: 
    // astar: 
    dAppStakingDeveloperContractAddress = 'ZowLuDSzzxNMsVT6Ys3yRQ92p4WWUv8TVcowB2QTpg172cg';

    // shibuya: Ydzxdwjp1RHtuKmKbxr98qaKgjfnDtfGURaeYZP3ZdbpSXE
    // shiden: 
    // astar: 
    luckyOracleContractAddress = 'Ydzxdwjp1RHtuKmKbxr98qaKgjfnDtfGURaeYZP3ZdbpSXE';

    // shibuya: W66fXdDBkcp7RkZmsS7qLLpjdHB4FDSqWgJArbvCYG3PQ48
    // shiden: 
    // astar: 
    rewardManagerContractAddress = 'W66fXdDBkcp7RkZmsS7qLLpjdHB4FDSqWgJArbvCYG3PQ48';

    // shibuya: X7Rxmt4JshNbZ9uEujXhAKkZBNSmpJwvZGPExCHpt6ebmCe
    // shiden: 
    // astar: 
    luckyRaffleContractAddress = 'X7Rxmt4JshNbZ9uEujXhAKkZBNSmpJwvZGPExCHpt6ebmCe';    
      

    subqlUrl = 'http://localhost:3000/';

    /* IT'S STRONGLY RECOMMENDED TO USE A PROXY */
    worker_seed = 'element garage roast warfare annual success comic below spot axis yard audit'; 
     
   }
   
export const config = new Config();

export function displayConfiguration(){
    console.log('RPC: %s', config.rpc);
    console.log('dAppStaking application contract address: %s', config.dAppStakingApplicationContractAddress);
    console.log('dAppStaking developer contract address: %s', config.dAppStakingDeveloperContractAddress);
    console.log('lucky oracle contract address: %s', config.luckyOracleContractAddress);
    console.log('reward manager contract address: %s', config.rewardManagerContractAddress);
    console.log('raffle contract address: %s', config.luckyRaffleContractAddress);
    console.log('subQL url: %s', config.subqlUrl);
}

