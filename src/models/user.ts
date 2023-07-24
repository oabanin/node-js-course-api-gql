import {Schema, model} from "mongoose";


interface IUser {
    email: string;
    password: string;
    name: string;
    status: string;
    posts: string[]
}

const userSchema = new Schema({
        email: {
            type: String,
            required: true
        },
        password: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        status: {
            type: String,
            default: 'I am new!'
        },
        posts: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Post'
            }
        ]
    }
);

const User = model<IUser>('User', userSchema);

export {User}
