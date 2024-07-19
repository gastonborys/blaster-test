require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const { v4: uuidv4} = require('uuid');

const mongoDbUrl 	= process.env.MONGO_DB_URL;
const apiKey 		= process.env.API_KEY;
const INTERVAL 		= parseInt(process.env.INTERVAL) || 10;
mongoose.connect(mongoDbUrl, 
	{ useNewUrlParser: true, useUnifiedTopology: true }, (err) => {
		if (err) {
			console.error('Error connecting to MongoDB:', err);
		} else {
			console.log('Connected to MongoDB!');
		}
	});
	
const callSchema = new mongoose.Schema({
	uuid				: {type: String, index: true, required: true, unique: true},
	number				: {type: String, index: true, required: true},
	blasterType			: {type: String, required: true},
	audioId				: {type: String, required: true},
	pressElection		: {type: String, required: true},
	amd					: {type: Boolean, required: true},
	auxiliaryField		: {type: String, index: true, required: true},
	durationCall		: {type: Number, required: true},
	ringTime			: {type: Number, required: true},
	amdMessage			: {type: Boolean, required: true},
	testMode			: {type: Boolean, required: false, default: false},
	notifyUrl			: {type: String, required: true},
	notifyHttpMethod	: {type: String, required: true},
	status 				: {type: String, index: true, default: "new"},
	result 				: {type: String, default: "waiting"},
});

const Call = mongoose.model('Call', callSchema);

const ttsCallSchema = new mongoose.Schema({
	uuid				: {type: String, index: true, required: true, unique: true},
	number				: {type: String, index: true, required: true},
	blasterType			: {type: String, required: true},
	pressElection		: {type: String, required: true},
	amd					: {type: Boolean, required: true},
	auxiliaryField		: {type: String, index: true, required: true},
	durationCall		: {type: Number, required: true},
	ringTime			: {type: Number, required: true},
	testMode			: {type: Boolean, required: false, default: false},
	amdMessage			: {type: Boolean, required: true},
	templateId			: {type: String, required: true},
	voiceId				: {type: String, required: true},
	templateParams: {
		type: Object,
		default: {}
	},
	notifyUrl			: {type: String, required: true},
	notifyHttpMethod	: {type: String, required: true},
	status 				: {type: String, index: true, default: "new"},
	result 				: {type: String, default: "waiting"},
});

const TtsCall = mongoose.model('TtsCall', ttsCallSchema);

const audioSchema = new mongoose.Schema({
	uuid				: {type: String, index: true, required: true, unique: true},
	name				: {type: String, index: true, required: true, unique: true},
	filename			: {type: String, index: true, required: true, unique: true},
});

const Audio = mongoose.model('Audio', audioSchema);

const ttsTemplateSchema = new mongoose.Schema({
	uuid				: {type: String, index: true, required: true, unique: true},
	name				: {type: String, index: true, required: true, unique: true},
	template			: {type: String, index: true, required: true, unique: true},
});

const TtsTemplate = mongoose.model('TtsTemplate', ttsTemplateSchema);

const statusSchema = new mongoose.Schema({
    value: { type: String, required: true },
    weight: { type: Number, required: true }
});

const Status = mongoose.model('Status', statusSchema);


app.use(express.json());

// Middleware
app.use((req, res, next) => {
	const apikey = req.header('API-KEY');
	
	if (!apikey || apikey !== apiKey) {
		return res.status(401).send({ message: 'Invalid API-KEY' });
	}
	
	next();
	
});

app.post('/call', (req, res) => {
	
	const data = {
		uuid: uuidv4(),
		...req.body,
	};

	const call = new Call(data);

	call.save((err, call) => {
		if (err) {
			res.status(500).send({ message: 'Error creating call', err });
		}
		else {
			res.send({ callId: call.uuid, status: call.status });
		}
	});
});

app.post('/call/tts', (req, res) => {
	
	const data = {
		uuid: uuidv4(),
		...req.body,
	};
	
	const ttsCall = new TtsCall(data);
	
	ttsCall.save((err, call) => {
		if (err) {
			res.status(500).send({ message: 'Error creating Ttscall', err });
		}
		else {
			res.send({ callId: call.uuid, status: call.status });
		}
	});
});

app.post('/audios', (req, res) => {
	const data = {
		uuid: uuidv4(),
		...req.body,
	};
	
	const audio = new Audio(data);
	audio.save((err, audio) => {
		if (err) {
			res.status(500).send({ message: 'Error al crear audio', err });
		}
		else {
			res.send({ audio });
		}
	});
});

app.get('/audios', (req, res) => {

	Audio.find().then(audios => {

		res.send(audios);

	})
	.catch(err => {
		res.status(500).send({ message: 'Error al obtener audios', err});
	});
});

app.post('/tts-template', (req, res) => {
	
	const data = {
		uuid: uuidv4(),
		...req.body,
	};

	const ttsTemplate = new TtsTemplate(data);
	
	ttsTemplate.save((err, ttsTemplate) => {
		if (err) {
			res.status(500).send({ message: 'Error creating tts template', err });
		}
		else {
			res.send({ ttsTemplate });
		}
	});
});

app.get('/tts-template', (req, res) => {
	TtsTemplate.find().then(ttsTemplates => {
		res.send(ttsTemplates);
	})
	.catch(err => {
		res.status(500).send({ message: 'Error obteniendo template tts', err });
	});
});


app.listen(3200, () => {
	console.log('Server running on port 3200');
});

const getStatus = async () => {
	try {
		const statuses = await Status.find();
		const totalWeight = statuses.reduce((sum, status) => sum + status.weight, 0);
		let random = Math.random() * totalWeight;
		
		for (const status of statuses) {
			if (random < status.weight) {
				return status.value;
			}
			random -= status.weight;
		}

	}
	catch (error) {
		console.error("getStatus", error);
	}
};



setInterval(async () => {
	try {
		const calls = await Call.find({ result: 'waiting' });
		const ttscalls = await TtsCall.find({ result: 'waiting' });
		
		const waitingCalls = [...calls, ...ttscalls];
		
		waitingCalls.forEach(async (call) => {
			const call_response = await getStatus();

			let status = "";
			switch (call_response){
				case "ANSWERED":
					status = "success";
					break;
				case "CONGESTION":
				case "NOANSWER":
					status = "error";
					break;
				default:
					status = "error";
			}

			call.status = status;
			call.result = call_response;
			const data = {
				uuid			: call.uuid,
				status			: call.status,
				testMode		: call.testMode,
				pressElection	: call.pressElection,
				blasterType		: call.blasterType,
				auxiliaryField	: call.auxiliaryField,
				number			: call.number,
				result			: call.result,
			};

			fetch(call.notifyUrl, {
				method: call.notifyHttpMethod,
				body: JSON.stringify(data),
				headers: {
					'Content-Type': 'application/json'
				}
			})
			.then((response) => {
				if (response.ok) {
					console.log(`Noficación enviada a ${call.notifyUrl} correctamente`);
					call.save((err) => {
						if (err) {
							console.error(`Error al modificar el registro: ${err}`);
						} else {
							console.log(`Estado actualizado ${call_response}`);
						}
					});
				} else {
					throw new Error(`Error al enviar la notificación ${call.notifyUrl}: ${response.status}`);
				}
			})
			.catch((error) => {
				console.error(`Error al enviar la notificación a ${call.notifyUrl}: ${error}`);
			});
			
		});
	} catch (error) {
		console.error(`Error querying collections: ${error}`);
	}
}, INTERVAL * 1000); 