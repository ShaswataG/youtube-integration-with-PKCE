require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const oauth2 = google.auth.OAuth2;
const app = express();
console.log('redirect URL', process.env.REDIRECT_URI);

const oauth2Client = new oauth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl'
];

const ALLOWED_ORIGINS = ['http://localhost:5173'];

app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true
}));
app.use(express.json());

// 1. Auth entrypoint logs verifier/challenge on console
app.get('/auth', (req, res) => {
  const { state, code_challenge } = req.query;
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    code_challenge,
    code_challenge_method: 'S256'
  });
  console.log('PKCE state:', state);
  console.log('PKCE code_challenge:', code_challenge);
  console.log('url:', url);
  res.redirect(url);
});

// 2. Backend callback to exchange tokens
app.get('/oauth2callback', async (req, res) => {
  const { code, state, code_verifier } = req.query;
  console.log('code:', code);
  console.log('state:', state);
  console.log('code_verifier:', code_verifier);
  console.log('redirect_uri:', process.env.REDIRECT_URI);
  try {
    const { tokens } = await oauth2Client.getToken({
      code,
      code_verifier,
      redirect_uri: process.env.REDIRECT_URI
    });
    oauth2Client.setCredentials(tokens);

    console.log('tokens: ');

    // TODO: Securely store tokens and link to state/user session
    console.log('Obtained tokens for state', state, tokens);
    res.send('Authentication complete — you can close this window.');
  } catch (err) {
    console.error('Token exchange error', err);
    res.status(500).send('Authentication failed.');
  }
});






// 3. Test endpoint for live stream data
app.post('/status', async (req, res) => {
//   const { access_token, refresh_token } = req.body;
  console.log('req.body:', req.body);
  const scope = 'https://www.googleapis.com/auth/youtube.force-ssl';

  oauth2Client.setCredentials(req.body);
  const service = google.youtube({version: 'v3', auth: oauth2Client});
  const lbr = await service.liveBroadcasts.list({
    part: 'snippet',
    // broadcastStatus: 'active',
    mine: true
  });
  if (lbr.data.items.length === 0) return res.send('No active stream');
  
  const vid = lbr.data.items[0].id;
  const chatId = lbr.data.items[0].snippet.liveChatId;
  
  const video = await service.videos.list({
    part: 'liveStreamingDetails',
    id: vid
  });
  console.log('video:', JSON.stringify(video.data.items));
  const item = video.data.items && video.data.items[0];
  if (!item || !item.liveStreamingDetails) {
    return res.status(404).json({ error: 'No live streaming details for this video.' });
  }
  const viewers = video.data.items[0]
                          .liveStreamingDetails
                          .concurrentViewers;
  console.log('viewers: ', viewers);

  res.json({videoId: vid, chatId, viewers});
});

// 4. Endpoint to post chat messages
app.post('/chat', express.json(), async (req, res) => {

  const {
    access_token, refresh_token, scope, token_type, expiry_date,
    chatId, message
  } = req.body;
  
  oauth2Client.setCredentials({
    access_token, refresh_token, scope, token_type, expiry_date
  });
  const service = google.youtube({version: 'v3', auth: oauth2Client});
  await service.liveChatMessages.insert({
    part: 'snippet',
    requestBody: {
      snippet: {
        liveChatId: chatId,
        type: 'textMessageEvent',
        textMessageDetails: {messageText: message}
      }
    }
  });
  res.send('Chat message sent!');
});


// Additional Endpoints
// 4.1. Endpoint to list all videos on the channel
app.get('/videos', async (req, res) => {

  oauth2Client.setCredentials(req.body);
  // OAuth client already has credentials from callback
  const service = google.youtube({ version: 'v3', auth: oauth2Client });

  try {
    // 1️⃣ Get uploads playlist ID
    const chRes = await service.channels.list({
      part: 'contentDetails',
      mine: true
    });
    const ch = chRes.data.items?.[0];
    if (!ch) return res.status(404).send('Channel not found');
    const playlistId = ch.contentDetails.relatedPlaylists.uploads;

    // 2️⃣ Paginate through playlistItems
    const videos = [];
    let nextPageToken = null;

    do {
      const plRes = await service.playlistItems.list({
        part: 'snippet,contentDetails',
        playlistId,
        maxResults: 50,
        pageToken: nextPageToken
      });

      plRes.data.items?.forEach(item => {
        videos.push({
          videoId: item.contentDetails.videoId,
          title: item.snippet.title,
          publishedAt: item.contentDetails.videoPublishedAt
        });
      });

      nextPageToken = plRes.data.nextPageToken;
    } while (nextPageToken);

    res.json({ videos });
  } catch (err) {
    console.error('Error fetching videos:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /channel-id — return the authorized user's channel ID
app.get('/channel-id', async (req, res) => {
  try {
    oauth2Client.setCredentials(req.body);
    const service = google.youtube({ version: 'v3', auth: oauth2Client });
    const response = await service.channels.list({
      part: 'id',
      mine: true,
    });
    const items = response.data.items;
    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'No channel found.' });
    }

    const channelId = items[0].id;
    res.json({ channelId });
  } catch (err) {
    console.error('Error fetching channel ID:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/comment-thread', async (req, res) => {
  const {
    access_token, refresh_token, scope, token_type, expiry_date,
    videoId, message
  } = req.body;
  
  oauth2Client.setCredentials({
    access_token, refresh_token, scope, token_type, expiry_date
  });

  const service = google.youtube({ version: 'v3', auth: oauth2Client });

  try {
    const response = await service.commentThreads.insert({
      part: 'snippet',
      requestBody: {
        snippet: {
          channelId: req.body.channelId,   // Your channel ID
          videoId: videoId,                // Target video ID
          topLevelComment: {
            snippet: {
              textOriginal: message        // Your comment text
            }
          }
        }
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error('Error posting top-level comment:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/comment', async (req, res) => {
  const { access_token, refresh_token, scope, token_type, expiry_date, message } = req.body;
  oauth2Client.setCredentials({
    access_token,
    refresh_token,
    scope,
    token_type,
    expiry_date
  });

  const service = google.youtube({ version: 'v3', auth: oauth2Client });

  try {
    const commentResponse = await service.comments.insert({
      part: 'snippet',
      requestBody: {
        snippet: {
          textOriginal: message,
          // parentId: 
        }
      }
    })    

    console.log('commentResponse:', commentResponse);

  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).json({ error: error.message });
  }
})

app.listen(process.env.PORT || 4000, () =>
  console.log('🔐 Backend listening on', process.env.PORT || 4000)
);