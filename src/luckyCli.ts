import yargs from 'yargs/yargs';
import { displayConfiguration } from './config';
import { initConnection } from './txHelper';
import { checkGrants} from './checkGrants';
import { getLastEraReceivedReward } from './queryIndexer';
import { getCurrentEra } from './dAppStaking';
import { checkRaffleConfiguration, getLastEraRaffleDone } from './raffle';
import { runEra, runNextEras } from './worker';

const argv = yargs(process.argv.slice(2)).options({
    ce: {alias: 'currentEra', desc: 'Display the current era for dApp staking'},
    lrr: {alias: 'lastEraReceivedReward', desc: 'Display the last era when the dapp received rewards from dApp staking'},
    lrd: {alias: 'lastEraRaffleDone', desc: 'Display the last era when the raffle has been run'},
    dc: {alias: 'displayConfiguration', desc: 'Diplay the configuration (contract and http addresses)'},
    ch: {alias: 'checks', desc: 'Check if the grants and the configuration in the smart contracts have been set'},
    cl: {alias: 'claim', desc: 'Claim dappStaking developer rewards for a given era - era is mandatory'},
    ri: {alias: 'readIndex', desc: 'Read data from the indexer for a given era - era is mandatory'},
    so: {alias: 'setOracle', desc: 'Set Oracle data for a given era - era is mandatory'},
    r:  {alias: 'raffle', desc: 'Start the raffle for a given era - era is mandatory'},
    a:  {alias: 'all', desc: 'Equivalent to --checks --claim --setOracle --raffle for a given era or for for all era (from --lastEra to --currentEra) if no era is provided'},
    era: {type: 'number', desc: 'Given era'},
    d: {alias: 'debug', desc: 'Debug mode: display more information'},
}).version('0.1').parseSync();


export function isDebug() : boolean{
    return argv.debug != undefined;
}


async function run() : Promise<void>{

    if (!argv.displayConfiguration 
        && !argv.currentEra && !argv.lastEraReceivedReward && !argv.lastEraRaffleDone && !argv.readIndex
        && !argv.checks && !argv.claim && !argv.setOracle && !argv.raffle && !argv.all 
        ) {
        return Promise.reject('At least one option is required. Use --help for more information');
    }

    if (argv.claim || argv.readIndex || argv.setOracle || argv.raffle) {
        if (argv.era == undefined){
            return Promise.reject('An era is required for this options. Use --help for more information');
        }
        if (argv.all){
            return Promise.reject('The option --all is not allow with --claim or --readIndex or ');
        }
    }

    const checks = argv.checks != undefined || argv.all != undefined; 
    const claim = argv.claim != undefined || argv.all != undefined; 
    const readIndex = argv.readIndex != undefined || argv.all != undefined;
    const setOracle = argv.setOracle != undefined || argv.all != undefined;
    const raffle = argv.raffle != undefined || argv.all != undefined;

    if (argv.displayConfiguration) {
        displayConfiguration();
    }

    if (argv.lastEraRaffleDone || argv.currentEra || checks || claim || setOracle || raffle) {
        await initConnection();
    }
    
    if (checks) {
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


    if (claim || readIndex || setOracle || raffle) {

        if (argv.era == undefined) {
            await runNextEras();
        } else {
            await runEra(argv.era, claim, readIndex, setOracle, raffle);
        }

    }
}

run().catch(console.error).finally(() => process.exit());


