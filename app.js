require("dotenv").config();
const {google} = require("googleapis");
const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const port = process.env.PORT || 3000;
const cors = require("cors");
const { default: axios } = require("axios");
const app = express();

const apiClient = axios.create({
  baseURL: 'https://api.telex.im/api/v1', // Replace with actual API base URL
  headers: {
      Authorization: `Bearer ${process.env.AUTH_CODE}` // Token from .env
  }
});


async function getUserEmail(channelId, mentionedUser) {
  try {
      // Fetch users in the channel
      const response = await apiClient.get(`/channels/${channelId}/users`);

      const users = response.data.data;
      
      // Find the mentioned user's email
      const matchedUser = users.find(user => {
        console.log(user.profile?.full_name?.trim(), mentionedUser);
        return  (user.profile?.full_name?.trim() === mentionedUser) || (user.profile?.username?.trim() === mentionedUser) || (user.email?.trim() === mentionedUser) || (user.profile?.username?.trim() === mentionedUser)
        });

      if (matchedUser) {
          return matchedUser.email; // Return email of the mentioned user
      } else {
          return null; // No matching user found
      }
  } catch (error) {
      console.error('Error fetching users:', error.response ? error.response.data : error.message);
      throw new Error('Failed to retrieve users');
  }
}



//Middlewares...
const allowedOrigins = [
  "https://telex.im",
  "https://staging.telex.im",
  "http://telextest.im",
  "http://staging.telextest.im",
  "https://ping.telex.im",
  "http://ping.telex.im",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(express.json());

// Parsing Telex messages
function removeHtmlTags(input) {
  return input.replace(/<\/?[^>]+(>|$)/g, "");
}

// Configuring email transporter
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = "https://developers.google.com/oauthplayground";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

//Creating OAuth2 clientto ensure access token is continuousl refreshed
const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });


async function createTransporter() {
  try {

    const accessToken = await oAuth2Client.getAccessToken(); // Automatically refresh token
    if (!accessToken.token) {
      throw new Error("Failed to retrieve access token");
    }
    return nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      scope: "https://mail.google.com/",
      port: 587,
      secure: false,
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    });
  } catch (error) {
    console.error("Failed to refresh access token:", error);
    return null;
  }
}



let log;
//testing server
app.get('/', (req, res) => {
  res.send(`Hello Telex User! This is the Email Prompt integration server`);
})

// Integration endpoint to provide integration details to Telex
app.get('/integration.json', (req, res) => {
  const integration = {
      "data": {
        "date": {
          "created_at": "2025-02-17",
          "updated_at": "2025-02-17"
        },
        "descriptions": {
          "app_name": "Email Prompt 2",
          "app_description": "This integration helps further notifying a user via email whenever they are @mentioned",
          "app_logo": "https://logowik.com/content/uploads/images/513_email.jpg",
          "app_url": "ec2-51-20-134-49.eu-north-1.compute.amazonaws.com",
          "background_color": "#fff"
        },
        "is_active": true,
        "integration_type": "output",
        "key_features": [
          "Notification",
          "communication",
          "prompt"
        ],
        "permissions": {
          "monitoring_user": {
            "always_online": true,
            "display_name": "Email Prompt",
          }
        } ,
        "integration_category": "Email & Messaging",
        "author": "Shy programmer",
        "settings": [
          {
            "label": "Enable Email Notifications",
            "type": "checkbox",
            "required": true,
            "default": "true"
          },
          {
            "label": "channel_id",
            "type": "text",
            "required": true,
            "default": "#12345"
          }
        ],
        "target_url": "https://telex-branch.onrender.com/telex-target",
              }
    
  };
  res.json(integration);
});

// Webhook endpoint to receive messages from Telex
app.post("/telex-target", async (req, res) => {
  const { message, settings } = req.body; // Extract message data
  const channelIdSetting = settings?.find(setting => setting.label === "channel_id");
  const channelId = channelIdSetting ? channelIdSetting.default : null;


  let mailed = []
  if (!channelId || !message) {
    return res.status(400).json({ error: 'channelId (in settings) and message sent are required' });
}

const mentionedUser = message.match(/@(\w+)/g) || []; // Match @mention in message
if (mentionedUser.length === 0) {
    return res.status(400).json({ error: 'No @mention found in message' });
}

for (let mention of mentionedUser) {
  const username = mention.replace("@", "").trim();
  console.log(`Mentioned user: ${username}`);

// Get user's email from the channel
const email = await getUserEmail(channelId, username);
console.log(`Mentioned Email: ${email}`);
    if (email) {
      const transporter = await createTransporter();
      if (!transporter) {
        console.error(`Failed to create transporter. Skipping email to ${email}`);
        continue; // Skip this iteration if transporter is null
      }
      try {
          await transporter.sendMail({
          from: "earforsound@gmail.com",
          to: email,
          subject: `You were mentioned in a Telex channel`,
          text: `Message: ${removeHtmlTags(message)}`,
        });
        console.log(`Email sent to ${email}`);
      } catch (err) {
        console.error(`Error sending email to ${email}:`, err);
      }
    }
  }

   return res.json({
    status: "success", 
    message: "Emails sent successfully",
    to: mailed,
});
})


// Start server
app.listen(process.env.PORT || 3200, () => {
  console.log(`Server running on port ${port}`);
});
