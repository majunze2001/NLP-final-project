import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config()
import { ChatGPTUnofficialProxyAPI } from 'chatgpt'
import * as format from 'date-format'
import * as fs from 'fs';

async function generate(msg, cb) {
    const api = new ChatGPTUnofficialProxyAPI({
        accessToken: process.env.OPENAI_ACCESS_TOKEN,
        apiReverseProxyUrl: 'https://api.pawan.krd/backend-api/conversation',
        debug: true
    })
    try {
        const res = await api.sendMessage(msg,
            {
                timeoutMs: 30 * 1000 //time out 
            }
        )
        if (res) {
            console.log(res);
            await cb(msg + "\n" + res.text)
        }
    } catch (error) {
        console.error(error)
    }

}

while (1) {
    console.log("round");
    const filename = "data/" + format.asString('MM_dd_hh_mm_ss.txt', new Date())
    const saveResult = async (res) => {
        await fs.appendFile(filename, res + "\n", (err) => {
            if (err) {
                console.error(err)
            }
        })
    }
    for (let i = 0; i < 10; i++) {
        console.log(i + 1);
        await generate("Tell me something", saveResult)
    }
    // sleep for 500 ms
    await new Promise(r => setTimeout(r, 500));
}