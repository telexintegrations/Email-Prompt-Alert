require("dotenv").config();
const {google} = require("googleapis");
const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const port = process.env.PORT || 3000;
const cors = require("cors");
const app = express();

//Middlewares...
const allowedOrigins = [
  "https://telex.im",
  "https://staging.telex.im",
  "http://telextest.im",
  "http://staging.telextest.im",
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
        grantType: "refresh_token",
        accessToken: accessToken.token,
      },
    });
  } catch (error) {
    console.error("Failed to refresh access token:", error);
    return null;
  }
}




//testing server
app.get('/', (req, res) => {
  res.send("Hello Telex User! This is the Email Prompt integration server");
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
          "app_name": "Email Prompt",
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
            "label": "Trigger event",
            "type": "dropdown",
            "required": true,
            "default": "message_posted",
            "options": [
              "message_posted",
              "channel_updated",
              "user_mentioned"
            ]
          },
          {
            "label": "message",
            "type": "text",
            "required": true,
            "default": ""
          },
          {
            "label": "Sender",
            "type": "text",
            "required": true,
            "default": ""
          },
          {
            "label": "Channel",
            "type": "text",
            "required": true,
            "default": ""
          },
          {
            "label": "Mentions",
            "type": "text",
            "required": true,
            "default": ""
          },
          {
            "label": "Enable Email Notifications",
            "type": "checkbox",
            "required": true,
            "default": "true"
          }
        ],
        "target_url": "http://51.20.134.49:3200/telex-target",
      }
    
  };
  res.json(integration);
});

// Webhook endpoint to receive messages from Telex
app.post("/telex-target", async (req, res) => {
  const { message, settings } = req.body; // Extract message data

  if (!message) return res.status(400).json({message: "No message received"});

  // Extract mentioned users
  const mentionedUsers = message.match(/@[\w.-]+@[\w.-]+\.com/g) || [];
  
  for (let mention of mentionedUsers) {
    const email = mention.replace("@", "");
    
    if (email) {
      const transporter = await createTransporter();
      try {
          transporter.sendMail({
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
    message: "Processed mentions successfully",
    from: message,
});
})


// Start server
app.listen(3200, () => {
  console.log(`Server running on port ${port}`);
});
