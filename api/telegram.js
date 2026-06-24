const https = require('https');

const TG_TOKEN = process.env.TG_BOT_TOKEN;
const OR_KEY = process.env.OPENROUTER_API_KEY;
const OR_MODEL = 'openai/gpt-oss-20b:free';
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;

const chatHistory = {};

function httpsPost(hostname, path, headers, body) {
    return new Promise((resolve, reject) => {
        const data = typeof body === 'string' ? body : JSON.stringify(body);
        const req = https.request({
            hostname, path, method: 'POST',
            headers: { ...headers, 'Content-Length': Buffer.byteLength(data) }
        }, res => {
            let buf = '';
            res.on('data', c => buf += c);
            res.on('end', () => {
                try { resolve(JSON.parse(buf)); } catch(e) { resolve(buf); }
            });
        });
        req.on('error', reject);
        req.setTimeout(25000, () => { req.destroy(); reject(new Error('timeout')); });
        req.write(data);
        req.end();
    });
}

async function orApi(messages) {
    const systemPrompt = [
        'You are Afoniya, a friendly heating engineer assistant for Sasha White company in SPb Russia.',
        'Answer in RUSSIAN ONLY. Be warm, friendly, use emoji. Keep replies short (2-5 sentences).',
        'Prices: warm floor 2500-4500 rub/m2, radiators 12000-18000 rub/pc, boiler room from 145000 rub.',
        'Materials: Rehau, Baxi, TECH, De Dietrich. 5 year warranty. Phone: +7 (911) 924-54-25.',
        'End each reply with a call to action: call us, use calculator, book a measurement.'
    ].join(' ');

    const res = await httpsPost('openrouter.ai', '/api/v1/chat/completions',
        {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + OR_KEY,
            'HTTP-Referer': 'https://sasha-heating.ru',
            'X-Title': 'Afoniy Bot'
        },
        {
            model: OR_MODEL,
            max_tokens: 250,
            temperature: 0.8,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages.slice(-8)
            ]
        }
    );
    if (res && res.choices && res.choices[0]) return res.choices[0].message.content;
    return 'Pereformuliruyte pozhaluysta!';
}

async function tgSend(chatId, text) {
    await httpsPost('api.telegram.org', '/bot' + TG_TOKEN + '/sendMessage',
        { 'Content-Type': 'application/json' },
        { chat_id: chatId, text: text }
    );
}

async function processAsync(chatId, text, name) {
    if (!chatHistory[chatId]) chatHistory[chatId] = [];
    chatHistory[chatId].push({ role: 'user', content: text });
    try {
        const reply = await orApi(chatHistory[chatId]);
        chatHistory[chatId].push({ role: 'assistant', content: reply });
        await tgSend(chatId, reply);
        if (OWNER_CHAT_ID) {
            await tgSend(OWNER_CHAT_ID, name + ': ' + text + '\nBot: ' + reply);
        }
    } catch(e) {
        await tgSend(chatId, 'Oshibka soedineniya. Poprobujte cherez minutu!');
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).send('Afoniy Bot is running');
    }
    const update = req.body;
    if (!update || !update.message || !update.message.text) {
        return res.status(200).send('OK');
    }
    const chatId = update.message.chat.id;
    const text = update.message.text;
    const name = update.message.chat.first_name || 'User';
    processAsync(chatId, text, name).catch(() => {});
    res.status(200).send('OK');
};
