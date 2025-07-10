const fetch = require('node-fetch');

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
    const { query, page = 1 } = event.queryStringParameters;

    if (!query) {
        return { statusCode: 400, body: 'A search query is required.' };
    }

    try {
        const response = await fetch(process.env.GOOGLE_SHEET_URL);
        if (!response.ok) {
            return { statusCode: response.status, body: 'Failed to fetch Google Sheet.' };
        }

        // 구글이 보내주는 UTF-8 텍스트를 그대로 받습니다.
        const csvData = await response.text();
        const songList = parseCSV(csvData);

        const lowerCaseQuery = query.toLowerCase();
        const filteredResults = songList.filter(song =>
            (song.artist && song.artist.toLowerCase().includes(lowerCaseQuery)) ||
            (song.title && song.title.toLowerCase().includes(lowerCaseQuery))
        );

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
        return { statusCode: 500, body: `Server error: ${error.toString()}` };
    }
};