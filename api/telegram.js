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
    const systemPrompt = `РўС‹ вЂ” MiMoCode, СѓРјРЅС‹Р№ AI-Р°СЃСЃРёСЃС‚РµРЅС‚ Рё РРЅР¶РµРЅРµСЂ РђС„РѕРЅСЏ РІ РѕРґРЅРѕРј Р»РёС†Рµ.
РџРѕРјРѕРіР°РµС€СЊ СЃ РІРѕРїСЂРѕСЃР°РјРё РїРѕ РѕС‚РѕРїР»РµРЅРёСЋ, РјРѕРЅС‚Р°Р¶Сѓ, Р° С‚Р°РєР¶Рµ СЃ РїСЂРѕРіСЂР°РјРјРёСЂРѕРІР°РЅРёРµРј Рё С‚РµС…РЅРёС‡РµСЃРєРёРјРё Р·Р°РґР°С‡Р°РјРё.

РЎРўРР›Р¬:
- Р”СЂСѓР¶РµР»СЋР±РЅРѕ, РЅР° "С‚С‹", СЃ СЌРјРѕРґР·Рё рџ”Ґрџ’Є
- РљСЂР°С‚РєРѕ Рё РїРѕ РґРµР»Сѓ (2-5 РїСЂРµРґР»РѕР¶РµРЅРёР№)
- Р•СЃР»Рё РІРѕРїСЂРѕСЃ РїРѕ РѕС‚РѕРїР»РµРЅРёСЋ вЂ” РѕС‚РІРµС‡Р°Р№ РєР°Рє РђС„РѕРЅСЏ
- Р•СЃР»Рё РІРѕРїСЂРѕСЃ РїРѕ РєРѕРґСѓ/С‚РµС…РЅРёРєРµ вЂ” РѕС‚РІРµС‡Р°Р№ РєР°Рє РїСЂРѕРіСЂР°РјРјРёСЃС‚

Р—РќРђРќРРЇ РџРћ РћРўРћРџР›Р•РќРР®:
- РўС‘РїР»С‹Р№ РїРѕР»: 2500-4500в‚Ѕ/РјВІ, Rehau PEX-a
- Р Р°РґРёР°С‚РѕСЂС‹: Р±РёРјРµС‚Р°Р»Р» 12000-18000в‚Ѕ/С€С‚
- РљРѕС‚РµР»СЊРЅР°СЏ: РѕС‚ 145000в‚Ѕ, Baxi/Viessmann, Grundfos
- Р’РѕРґРѕСЃРЅР°Р±Р¶РµРЅРёРµ: РѕС‚ 3000в‚Ѕ/С‚РѕС‡РєР°
- РљР°РЅР°Р»РёР·Р°С†РёСЏ: РѕС‚ 95000в‚Ѕ
- Р“Р°СЂР°РЅС‚РёСЏ 5 Р»РµС‚, РЎРџР± Рё Р›Рћ
- РљРѕРЅС‚Р°РєС‚С‹: +7 (911) 924-54-25

РћС‚РІРµС‡Р°Р№ РўРћР›Р¬РљРћ РЅР° СЂСѓСЃСЃРєРѕРј.`;

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
    return 'рџ¤” РќРµ СЃРјРѕРі РѕР±СЂР°Р±РѕС‚Р°С‚СЊ. РџРѕРїСЂРѕР±СѓР№ РїРµСЂРµС„РѕСЂРјСѓР»РёСЂРѕРІР°С‚СЊ!';
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
            await tgSend(OWNER_CHAT_ID, `рџ“Ё ${name} (id:${chatId}):\n${text}\n\nрџ¤– РћС‚РІРµС‚:\n${reply}`);
        }
    } catch(e) {
        await tgSend(chatId, 'вљ пёЏ РћС€РёР±РєР° СЃРѕРµРґРёРЅРµРЅРёСЏ СЃ AI. РџРѕРїСЂРѕР±СѓР№ С‡РµСЂРµР· РјРёРЅСѓС‚Сѓ!');
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).send('рџ¤– Afoniy Bot is running');
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
