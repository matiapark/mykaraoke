const fetch = require('node-fetch');
const iconv = require('iconv-lite'); // <-- 인코딩 변환 도구 불러오기

function parseCSV(csvText) {
    const rows = csvText.trim().split(/\r?\n/).slice(1);
    return rows.map(row => {
        const columns = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        if (columns.length < 3) return null;
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
        
        // --- ✨ 수정된 부분 시작 ✨ ---
        // 구글 시트 데이터를 버퍼(원본 데이터 조각) 형태로 받음
        const buffer = await response.buffer(); 
        // EUC-KR 형식의 원본 데이터를 UTF-8 텍스트로 변환(디코딩)
        const csvData = iconv.decode(buffer, 'euc-kr');
        // --- ✨ 수정된 부분 끝 ✨ ---
        
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