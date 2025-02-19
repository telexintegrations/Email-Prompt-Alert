require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const axios = require("axios");
const port = process.env.PORT || 3200;
const cors = require("cors");
const app = express();

//Middlewares...
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());


// Configuring email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

//testing server
app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/integration.json', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
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
app.route("/telex-target")
.post(async (req, res) => {
  const { message, settings } = req.body; // Extract message data

  if (!message) return res.status(400).json({message: "No message received"});

  // Extract mentioned users
  const mentionedUsers = message.match(/@(\w+)/g) || [];
  
  for (let mention of mentionedUsers) {
    const email = mention.replace("@", "");

    if (email) {
      await transporter.sendMail({
        from: "earforsound@gmail.com",
        to: email,
        subject: `You were mentioned in a Telex channel`,
        text: `Message: ${message}`,
      }, (err, info) => {
        if (err) {
          console.log(err);
        }
        else {
          console.log(`Email sent to ${email}`);
      }});
    }
  }

   res.json({
    status: "success", 
    message: "Processed mentions successfully",
    at: mentionedUsers,
    from: message,
    to: email,
});
})
.get(async (req, res) => {
  const message = "hello @iamnotdavidoadeleke@gmail.com boy"
  const settings = "nil"

  // Extract mentioned users
  const mentionedUsers = message.match(/@(\w+)/g) || [];
  
  for (let mention of mentionedUsers) {
    const email = mention.replace("@", "");

    if (email) {
      await transporter.sendMail({
        from: "earforsound@gmail.com",
        to: email,
        subject: `You were mentioned in a Telex channel`,
        text: `Message: ${message}`,
      }, (err, info) => {
        if (err) {
          console.log(err);
        }
        else {
          console.log(`Email sent to ${email}`);
      }});
    }
  }

  res.json({
    status: "success", 
    message: "Processed mentions successfully",
    at: mentionedUsers,
    from: message,
    to: email,
});
})

// Start server
app.listen(3200, () => {
  console.log(`Server running on port ${port}`);
});
