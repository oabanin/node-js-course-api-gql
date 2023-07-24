import express, {Request, Response, NextFunction} from "express";
import * as bodyParser from "body-parser";
import path from "path";
import {readFile} from "fs/promises";
import {resolvers} from "./graphql/resolvers";
import {connect} from "mongoose";
import * as fs from "fs";
import multer from "multer";
import {expressMiddleware} from "@apollo/server/express4";
import {ApolloServerPluginDrainHttpServer} from '@apollo/server/plugin/drainHttpServer';
// import cors from 'cors';

import {ApolloServer} from "@apollo/server"
import {startStandaloneServer} from "@apollo/server/standalone"


const fileStorage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, 'images')
    },
    filename: (req, file, callback) => {
        callback(null, new Date().toISOString() + "-" + file.originalname)
    }
})

const fileFilter = (req: any, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    if (file.mimetype === "image/png" || file.mimetype === "image/jpeg" || file.mimetype === "image/jpg") {
        callback(null, true)
    } else {
        callback(null, false)
    }
}

const app = express();
const http = require('http');

import 'dotenv/config'
import {GraphQLFormattedError} from "graphql/error";
import {ApolloServerErrorCode} from "@apollo/server/errors";
import {auth} from "./middleware/auth";

export const MONGODB_URI = process.env.MONGODB_URI || ''
// app.use(bodyParser.urlencoded({})) //x-www-form-url-endcoded

app.use(bodyParser.json()); //application/json
app.use(multer({storage: fileStorage, fileFilter}).single('image'))

app.use('/images', express.static(path.join(__dirname, '../images')));
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next()
})

app.use(auth);

app.put('/post-image', (req: Request, res:Response) => {
    if (!req.isAuth) {
        throw new Error('Not authenticated!');
    }
    if (!req.file) {
        return res.status(200).json({message: 'No file provided!'});
    }
    if (req.body.oldPath) {
        clearImage(req.body.oldPath);
    }
    return res
        .status(201)
        .json({message: 'File stored.', filePath: req.file.path});
});

//Error handler
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
    const status = error.statusCode || 500;
    const message = error.message;
    const data = error.data;
    res.status(status).json({message: message, data: data});
});


interface MyContext {
    token?: String;
}

interface GQLError extends GraphQLFormattedError {
    message: any
    originalError?: any
}

connect(MONGODB_URI)
    .then(async (result) => {
        const httpServer = http.createServer(app);
        //server.listen(8080)
        const typeDefs = await readFile(path.join(__dirname, 'graphql', 'schema.graphql'), "utf-8");

        const server = new ApolloServer<MyContext>({
            typeDefs,
            resolvers,
            plugins: [ApolloServerPluginDrainHttpServer({httpServer})],
            // },
            formatError: (formattedError, error) => {
                // Return a different error message
                if (
                    formattedError?.extensions?.code ===
                    ApolloServerErrorCode.BAD_USER_INPUT
                ) {
                    return {
                        ...formattedError,
                        message: "Test message",
                        errors: formattedError.extensions.errors
                    };
                }

                // Otherwise return the formatted error. This error can also
                // be manipulated in other ways, as long as it's returned.
                return formattedError;
            },
        });
        await server.start();
        app.use(
            '/graphql',
            expressMiddleware(server, {
                context: async ({req}: { req: any }) => ({isAuth: req.isAuth, userId: req.userId}),
            }),
        );

        await new Promise<void>((resolve) => httpServer.listen({port: 8080}, resolve));


        // const apolloServer = new ApolloServer<MyContext>({
        //     typeDefs,
        //     resolvers,
        // })

        // const { url } = await startStandaloneServer(apolloServer, {listen:{
        //     }})

        // console.log(`🚀 Server ready at ${url}`)

    })
    .catch(console.log)


const clearImage = (filePath: string) => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => console.log(err));
};