const https = require('https');

const TG_TOKEN = process.env.TG_BOT_TOKEN;
const OR_KEY = process.env.OPENROUTER_API_KEY;
const OR_MODEL = 'openai/gpt-oss-20b:free';
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;

let lastUpdateId = 0;
const chatHistory = {};

function httpsRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let buf = '';
            res.on('data', c => buf += c);
            res.on('end', () => { try { resolve(JSON.parse(buf)); } catch(e) { reject(e); } });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

async function tgApi(method, body) {
    return httpsRequest({
        hostname: 'api.telegram.org',
        path: `/bot${TG_TOKEN}/${method}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, body);
}

async function orApi(messages) {
    const body = JSON.stringify({
        model: OR_MODEL,
        messages: [
            { role: 'system', content: `РўС‹ вЂ” MiMoCode, СѓРјРЅС‹Р№ AI-Р°СЃСЃРёСЃС‚РµРЅС‚ Рё РРЅР¶РµРЅРµСЂ РђС„РѕРЅСЏ РІ РѕРґРЅРѕРј Р»РёС†Рµ.
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

РћС‚РІРµС‡Р°Р№ РўРћР›Р¬РљРћ РЅР° СЂСѓСЃСЃРєРѕРј.` },
            ...messages.slice(-8)
        ],
        max_tokens: 250,
        temperature: 0.8
    });

    const res = await httpsRequest({
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OR_KEY}`,
            'HTTP-Referer': 'https://sasha-heating.ru',
            'X-Title': 'Afoniy Bot'
        }
    }, body);

    if (res && res.choices && res.choices[0]) return res.choices[0].message.content;
    return 'рџ¤” РќРµ СЃРјРѕРі РѕР±СЂР°Р±РѕС‚Р°С‚СЊ. РџРѕРїСЂРѕР±СѓР№ РїРµСЂРµС„РѕСЂРјСѓР»РёСЂРѕРІР°С‚СЊ!';
}

async function processMessage(chatId, text, firstName) {
    if (!chatHistory[chatId]) chatHistory[chatId] = [];
    chatHistory[chatId].push({ role: 'user', content: text });

    let reply;
    try {
        reply = await orApi(chatHistory[chatId]);
    } catch(e) {
        reply = 'вљ пёЏ РћС€РёР±РєР° СЃРѕРµРґРёРЅРµРЅРёСЏ СЃ AI. РџРѕРїСЂРѕР±СѓР№ С‡РµСЂРµР· РјРёРЅСѓС‚Сѓ!';
    }
    chatHistory[chatId].push({ role: 'assistant', content: reply });

    await tgApi('sendMessage', { chat_id: chatId, text: reply });

    if (OWNER_CHAT_ID && chatId.toString() !== OWNER_CHAT_ID.toString()) {
        await tgApi('sendMessage', {
            chat_id: OWNER_CHAT_ID,
            text: `рџ“Ё ${firstName} (id:${chatId}):\n${text}\n\nрџ¤– РћС‚РІРµС‚:\n${reply}`
        });
    }
}

async function poll() {
    while (true) {
        try {
            const res = await tgApi('getUpdates', { offset: lastUpdateId + 1, timeout: 30 });
            if (res && res.ok && res.result) {
                for (const update of res.result) {
                    lastUpdateId = update.update_id;
                    if (update.message && update.message.text) {
                        const chatId = update.message.chat.id;
                        const text = update.message.text;
                        const name = update.message.chat.first_name || 'Unknown';
                        console.log(`[${name}] ${text}`);
                        processMessage(chatId, text, name).catch(e => console.error('Error:', e.message));
                    }
                }
            }
        } catch(e) {
            console.error('Poll error:', e.message);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

console.log('рџ¤– Afoniy Bot Р·Р°РїСѓС‰РµРЅ!');
poll();
