const fetch = require('node-fetch');
const iconv = require('iconv-lite');

function parseCSV(csvText) {
    const rows = csvText.trim().split(/\r?\n/).slice(1);
    return rows.map(row => {
        const columns = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        if (columns.length < 3 || !columns[0] || !columns[1] || !columns[2]) return null;
        return {
            artist: (columns[0] || '').trim().replace(/^"|"$/g, ''),
            title: (columns[1] || '').trim().replace(/^"|"$/g, ''),
            videoId: (columns[2] || '').trim().replace(/^"|"$/g, ''),
        };
    }).filter(Boolean);
}

exports.handler = async function(event) {
    // --- ✨ 버전 확인용 로그 추가 ✨ ---
    console.log('[VERSION CHECK] Running v2 with cp949 encoding.');

    const { query, page = 1 } = event.queryStringParameters;

    if (!query) {
        return { statusCode: 400, body: 'A search query is required.' };
    }

    try {
        const response = await fetch(process.env.GOOGLE_SHEET_URL);
        if (!response.ok) {
            console.error('[DEBUG] Failed to fetch Google Sheet.', { status: response.status });
            return { statusCode: response.status, body: 'Failed to fetch Google Sheet.' };
        }
        
        const buffer = await response.buffer();
        const csvData = iconv.decode(buffer, 'cp949');
        
        const songList = parseCSV(csvData);

        console.log(`[DEBUG] Parsed ${songList.length} songs from CSV.`);
        if (songList.length > 0) {
          console.log('[DEBUG] First song data sample:', JSON.stringify(songList[0]));
        }
        
        const lowerCaseQuery = query.toLowerCase();
        const filteredResults = songList.filter(song =>
            (song.artist && song.artist.toLowerCase().includes(lowerCaseQuery)) ||
            (song.title && song.title.toLowerCase().includes(lowerCaseQuery))
        );

        console.log(`[DEBUG] Found ${filteredResults.length} matching songs.`);

        const itemsPerPage = 20;
        const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
        const startIndex = (page - 1) * itemsPerPage;
        const paginatedResults = filteredResults.slice(startIndex, startIndex + itemsPerPage);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                results: paginatedResults,
                totalPages: totalPages,
                currentPage: parseInt(page)
            }),
        };
    } catch (error) {
        console.error('[DEBUG] Function crashed:', error);
        return { statusCode: 500, body: `Server error: ${error.toString()}` };
    }
};