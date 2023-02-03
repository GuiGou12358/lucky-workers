import fetch from 'node-fetch';
import { config } from './config';
import { isDebug } from './luckyCli';

export async function getLastEraReceivedReward(): Promise<Number> {

    console.log('Get last era when the dApp received the rewards ... ');

    try {    
        const body = { query : 'query {developerRewards(orderBy: ERA_DESC, first:1) {nodes {era}}}' };

        if (isDebug()){
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

        if (isDebug()){
            console.log('Response status: %s', response.statusText);
        }        

        const data = await response.text();

        if (isDebug()){
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


export async function getRewards(
    era: Number
): Promise<BigInt> {

    console.log('Get rewards for era %s from indexer ...', era);

    try {    
        const body = { query : 'query {developerRewards(filter: { era: { equalTo: \"' + era + '\" } }) {nodes {amount, era}}}' };

        if (isDebug()){
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

        if (isDebug()){
            console.log('Response status: %s', response.statusText);        
        }

        const data = await response.text();

        if (isDebug()){
            console.log(data);
        }

        const node = JSON.parse(data).data.developerRewards.nodes[0];

        if (node == undefined){
            return Promise.reject("No data return by the indexer");
        }

        const rewards = node.amount;
        console.log('Rewards: %s', rewards);
        
        return BigInt(rewards);

    } catch(error) {
        console.log("Error when getting rewards: %s", error);
        return Promise.reject(error);
    }

}

export type Participant = {
    address: string;
    stake: BigInt;
}

interface GetParticipantsQueryResult {
    sum: { amount : string };
    keys: string[];
}

export async function getParticipants(
    era: Number
): Promise<Participant[]> {

    console.log('Get participants for era %s from indexer ...', era);

    try {    
        const body = { query : 'query {stakes(filter: { era: { lessThanOrEqualTo: \"' + era + '\" }}) {groupedAggregates(groupBy: [ACCOUNT_ID], having: { sum: { amount: { notEqualTo: "0" }}}) { sum{amount}, keys }}}' };

        if (isDebug()){
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

        if (isDebug()){
            console.log('Response status: %s', response.statusText);        
        }

        const data = await response.text();
        
        if (isDebug()){
            console.log(data);
        }

        var participants: Participant[] = [];

        var participantsQueryResult : Array<GetParticipantsQueryResult> = JSON.parse(data).data.stakes.groupedAggregates;

        for(let i=0; i<participantsQueryResult.length; i++){

            const address = participantsQueryResult[i].keys[0];

            if (isDebug()){
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
