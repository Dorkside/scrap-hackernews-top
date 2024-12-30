const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

const HN_TOP_STORIES_URL = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM_URL = 'https://hacker-news.firebaseio.com/v0/item';
const DATA_DIR = 'data';
const NUMBER_OF_STORIES = 30;

async function fetchTopStories() {
    try {
        // Fetch top story IDs
        const response = await axios.get(HN_TOP_STORIES_URL);
        const storyIds = response.data.slice(0, NUMBER_OF_STORIES);

        // Fetch details for each story
        const stories = await Promise.all(
            storyIds.map(id => 
                axios.get(`${HN_ITEM_URL}/${id}.json`)
                    .then(response => response.data)
            )
        );

        return stories;
    } catch (error) {
        console.error('Error fetching stories:', error);
        throw error;
    }
}

function generateMarkdown(stories) {
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toISOString().split('T')[1].split('.')[0];
    let markdown = `# Hacker News Top Stories - ${date} ${time}\n\n`;

    stories.forEach((story, index) => {
        markdown += `${index + 1}. [${story.title}](${story.url})\n`;
        markdown += `   - Points: ${story.score}\n`;
        markdown += `   - Comments: ${story.descendants}\n`;
        markdown += `   - Posted by: ${story.by}\n\n`;
    });

    return markdown;
}

async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR);
    }
}

async function main() {
    try {
        await ensureDataDir();
        
        console.log('Fetching top stories from Hacker News...');
        const stories = await fetchTopStories();
        
        const markdown = generateMarkdown(stories);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(DATA_DIR, `hn-top-${timestamp}.md`);
        
        await fs.writeFile(outputFile, markdown, 'utf-8');
        console.log(`Successfully saved ${NUMBER_OF_STORIES} stories to ${outputFile}`);
    } catch (error) {
        console.error('Failed to fetch and save stories:', error);
        process.exit(1);
    }
}

main(); 