import { setTimeout } from 'timers/promises';
import { getCurrentEra, claimDAppStaking } from './dAppStaking';
import { getLastEraReceivedReward, getRewards, getParticipants } from './queryIndexer';
import { setParticipants, setRewards, clearData } from './oracle';
import { getLastEraRaffleDone, runRaffle } from './raffle';


async function start(era: Number) : Promise<void>{
    console.log("Start era %s", era);
}

export async function runEra(
    era: Number, 
    claimDappStaking: boolean, 
    queryIndexer: boolean, 
    setOracleData: boolean, 
    raffle: boolean,
    clearOracleData: boolean
) : Promise<void>{
             
    let promise: Promise<any> = start(era);

    if (claimDappStaking){
        promise = promise.then(() => claimDAppStaking(era));
    }

    if (queryIndexer || setOracleData){
        promise = promise.then(() => 
            getRewards(era).catch(
                () => setTimeout(30000)
            .then(() => getRewards(era))
            .catch( 
                () => setTimeout(30000)
                .then( () => getRewards(era))
            )
        )); // try it 3 times because it can be a while for indexing data 

        if (setOracleData){
            promise = promise.then((rewards) => setRewards(era, rewards));
        }
    }

    if (queryIndexer || setOracleData){
        promise = promise.then(() => getParticipants(era));

        if (setOracleData){
            promise = promise.then((participants) => setParticipants(era, participants));
        }
    }

    if (raffle){
        promise = promise.then(() => runRaffle(era));
    }

    if (clearOracleData){
        promise = promise.then(() => clearData(era));
    }


    return promise.then(() => console.log("End era %s", era) );
}


export async function runNextEras() : Promise<void>{

    const lastEraReceivedReward = await getLastEraReceivedReward();
    const lastEraRaffleDone = await getLastEraRaffleDone();
    const currentEra = await getCurrentEra();

    if (lastEraReceivedReward != lastEraRaffleDone){
        return Promise.reject("There is a gap between the last era when the rewards have been received and when the raffle has been done. Manual intervention is need.");
    }

    if (lastEraRaffleDone == 0){
        return Promise.reject("First iteration must be manual with setting explicitely the era");
    }

    let era: number = lastEraRaffleDone.valueOf() + 1;

    while (era < currentEra){

        await runEra(era, true, true, true, true, true).then( 
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




