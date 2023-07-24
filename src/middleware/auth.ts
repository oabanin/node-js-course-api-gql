import {Request, Response, NextFunction} from "express";
import jwt from "jsonwebtoken"

const auth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.get('Authorization');
    if (!authHeader) {
        req.isAuth = false;
        return next();
    }
    const token = authHeader.split(' ')[1];
    let decodedToken:any;
    try {
        decodedToken = jwt.verify(token, process.env.TOKEN_SECRET_KEY as string);
    } catch (err) {
        req.isAuth = false;
        return next();
    }
    if (!decodedToken) {
        req.isAuth = false;
        return next();
    }
    req.userId = decodedToken.userId;
    req.isAuth = true;
    next();
};

export {auth}