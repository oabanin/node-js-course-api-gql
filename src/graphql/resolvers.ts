import {User} from "../models/user"
import {Post} from "../models/post";
import validator from "validator"
import bcrypt from "bcryptjs";
import {GraphQLError} from "graphql/error";

type ICreateUserInput = {
    email: string;
    password: string;
    name: string;
};

type ICreatePostInput = {
    title: string;
    content: string;
    imageUrl: string;
};

import {sign} from "jsonwebtoken";
import {clearImage} from "../utils/utils";

const resolvers = {
    Query: {
        login: async function (root: any, {email, password}: { email: string, password: string }) {
            const user = await User.findOne({email: email});
            if (!user) {
                throw new GraphQLError('User not found', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        statusCode: 401,
                    },
                });
            }
            const isEqual = await bcrypt.compare(password, user.password);
            if (!isEqual) {
                throw new GraphQLError('Password is incorrect', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        statusCode: 401,
                    },
                });
            }
            const token = sign(
                {
                    userId: user._id.toString(),
                    email: user.email
                },
                process.env.TOKEN_SECRET_KEY || '',
                {expiresIn: '1h'}
            );
            return {token: token, userId: user._id.toString()};
        },
        posts: async function (root: any, {page}: { page: number }, contextValue: any) {
            if (!contextValue.isAuth) {
                throw new GraphQLError('Not authenticated', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        statusCode: 401,
                    },
                });
            }
            if (!page) {
                page = 1;
            }
            const perPage = 2;
            const totalPosts = await Post.find().countDocuments();
            const posts = await Post.find()
                .sort({createdAt: -1})
                .skip((page - 1) * perPage)
                .limit(perPage)
                .populate('creator');
            return {
                posts: posts.map(p => {
                    return {
                        ...p.toObject(),
                        _id: p._id.toString(),
                        createdAt: p.createdAt.toISOString(),
                        updatedAt: p.updatedAt.toISOString()
                    };
                }),
                totalPosts: totalPosts
            };
        },
        post: async function (root: any, {id}: { id: string }, contextValue: any) {
            if (!contextValue.isAuth) {
                throw new GraphQLError('Not authenticated', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        statusCode: 401,
                    },
                });
            }
            const post = await Post.findById(id).populate('creator').exec();
            if (!post) {
                throw new GraphQLError('No post', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        statusCode: 401,
                    },
                });
            }
            return {
                ...post.toObject(),
                _id: post._id.toString(),
                createdAt: post.createdAt.toISOString(),
                updatedAt: post.updatedAt.toISOString()
            };
        }
    },

    Mutation: {
        createPost: async function (parent: any, {postInput}: {
            postInput: ICreatePostInput
        }, contextValue: any, info: any) {
            if (!contextValue.isAuth) {
                throw new GraphQLError('Not authenticated', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        statusCode: 401,
                    },
                });
            }
            const errors = [];
            if (
                validator.isEmpty(postInput.title) ||
                !validator.isLength(postInput.title, {min: 5})
            ) {
                errors.push({message: 'Title is invalid.'});
            }
            if (
                validator.isEmpty(postInput.content) ||
                !validator.isLength(postInput.content, {min: 5})
            ) {
                errors.push({message: 'Content is invalid.'});
            }
            if (errors.length > 0) {
                throw new GraphQLError('Invalid input', {
                    extensions: {
                        code: 'BAD_USER_INPUT',

                        errors,
                        statusCode: 422,
                    },
                });
            }
            const user = await User.findById(contextValue.userId);
            if (!user) {
                throw new GraphQLError('Invalid user', {
                    extensions: {
                        code: 'BAD_USER_INPUT',

                        errors,
                        statusCode: 401,
                    },
                });
            }
            const post = new Post({
                title: postInput.title,
                content: postInput.content,
                imageUrl: postInput.imageUrl,
                creator: user
            });
            const createdPost = await post.save();
            user.posts.push(createdPost._id.toString());
            await user.save()
            return {
                ...createdPost.toObject(),
                _id: createdPost._id.toString(),
                createdAt: createdPost.createdAt.toISOString(),
                updatedAt: createdPost.updatedAt.toISOString()
            };
        },
        createUser: async function (parent: any, {userInput}: { userInput: ICreateUserInput }) {
            const errors = [];
            if (!validator.isEmail(userInput.email)) {
                errors.push({message: 'E-Mail is invalid.'});
            }
            if (validator.isEmpty(userInput.password) ||
                !validator.isLength(userInput.password, {min: 5})) {
                errors.push({message: 'Password too short!'});
            }
            if (errors.length > 0) {
                throw new GraphQLError('Invalid argument value', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        errors,
                        statusCode: 422,
                    },
                });
            }


            const existingUser = await User.findOne({email: userInput.email});
            if (existingUser) {
                const error = new Error('User exists already!');
                throw error;
            }
            const hashedPw = await bcrypt.hash(userInput.password, 12);
            const user = new User({
                email: userInput.email,
                name: userInput.name,
                password: hashedPw
            });
            const createdUser = await user.save();
            return {...createdUser.toObject(), _id: createdUser._id.toString()};
        },
        updatePost: async function (parent: any, {id, postInput}: {
            id: string,
            postInput: ICreatePostInput
        }, contextValue: any) {
            if (!contextValue.isAuth) {
                throw new GraphQLError('Invalid argument value', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        statusCode: 401,
                    },
                });
            }
            const post = await Post.findById(id).populate('creator');
            if (!post) {
                throw new GraphQLError('Invalid argument value', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        statusCode: 404,
                    },
                });
            }
            if (post.creator._id.toString() !== contextValue.userId.toString()) {
                throw new GraphQLError('Invalid argument value', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        statusCode: 403,
                    },
                });
            }
            const errors = [];
            if (
                validator.isEmpty(postInput.title) ||
                !validator.isLength(postInput.title, {min: 5})
            ) {
                errors.push({message: 'Title is invalid.'});
            }
            if (
                validator.isEmpty(postInput.content) ||
                !validator.isLength(postInput.content, {min: 5})
            ) {
                errors.push({message: 'Content is invalid.'});
            }
            if (errors.length > 0) {
                throw new GraphQLError('Invalid argument value', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        statusCode: 422,
                    },
                });
            }
            post.title = postInput.title;
            post.content = postInput.content;
            if (postInput.imageUrl !== 'undefined') {
                post.imageUrl = postInput.imageUrl;
            }
            const updatedPost = await post.save();
            return {
                ...updatedPost.toObject(),
                _id: updatedPost._id.toString(),
                createdAt: updatedPost.createdAt.toISOString(),
                updatedAt: updatedPost.updatedAt.toISOString()
            };
        },
        deletePost: async function (parent: any, {id}: { id: string }, contextValue: any) {
            if (!contextValue.isAuth) {
                throw new GraphQLError('Invalid argument value', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        statusCode: 401,
                    },
                });
            }
            const post = await Post.findById(id);
            if (!post) {
                throw new GraphQLError('Invalid argument value', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        statusCode: 404,
                    },
                });
            }
            if (post.creator.toString() !== contextValue.userId.toString()) {
                throw new GraphQLError('Invalid argument value', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        statusCode: 403,
                    },
                });
            }
            clearImage(post.imageUrl);
            await Post.findByIdAndRemove(id);

            const user = await User.findByIdAndUpdate(contextValue.userId, {$pull: {posts: post._id}});
            await user?.save();
            return true;
        },
    }
}

export {resolvers};