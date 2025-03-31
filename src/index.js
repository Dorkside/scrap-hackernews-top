const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const { fetchTopStories } = require('./fetchStories');
const { generateMarkdown } = require('./generateMarkdown');
const { ensureDataDir } = require('./ensureDataDir');
const { saveStories } = require('./saveStories');

const DATA_DIR = 'data';
const NUMBER_OF_STORIES = 30;

/**
 * Main function to fetch top stories from Hacker News, generate markdown, and save to a file.
 */
async function main() {
    try {
        await ensureDataDir();
        
        console.log('Fetching top stories from Hacker News...');
        const stories = await fetchTopStories();
        
        const markdown = generateMarkdown(stories);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(DATA_DIR, `hn-top-${timestamp}.md`);
        
        await saveStories(outputFile, markdown);
        console.log(`Successfully saved ${NUMBER_OF_STORIES} stories to ${outputFile}`);
    } catch (error) {
        console.error('Failed to fetch and save stories:', error);
        process.exit(1);
    }
}

main();
