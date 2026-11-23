import { getAllKittyExpeditionTeamUuids } from '../utils/game/kittyExpedition';
import { runExpedition } from './runKittyExpedition';

const INTERVAL = 1000 * 60;

function parseArgs() {
    const groupArg = process.argv.find(arg => arg.startsWith('--group='));
    const groupCountArg = process.argv.find(arg => arg.startsWith('--groupCount='));
    const group = groupArg ? parseInt(groupArg.split('=')[1], 10) : 0;
    const groupCount = groupCountArg ? parseInt(groupCountArg.split('=')[1], 10) : 6;
    return { group, groupCount };
}

const { group, groupCount } = parseArgs();

let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function mainLoop() {
    while (running) {
        const startTime = Date.now();

        const allExpeditionTeamUuids = await getAllKittyExpeditionTeamUuids();

        const total = allExpeditionTeamUuids.length;
        const groupSize = Math.ceil(total / groupCount);
        const start = group * groupSize;
        let end = (group + 1) * groupSize;
        if (group === groupCount - 1) {
            end = total; // 最后一组处理剩余所有
        }
        const myExpeditionUuids = allExpeditionTeamUuids.slice(start, end);

        let time1 = Date.now()
        for (const expeditionUuid of myExpeditionUuids) {
            await runExpedition(expeditionUuid);
        }
        let time2 = Date.now()
        console.log(`Processing group ${group} with expeditions(${groupSize}) pass `, time2 - time1, 'ms');

        const elapsed = Date.now() - startTime;
        if (elapsed < INTERVAL) {
            await new Promise(res => setTimeout(res, INTERVAL - elapsed));
        }
    }
}

await mainLoop();
process.exit(0)