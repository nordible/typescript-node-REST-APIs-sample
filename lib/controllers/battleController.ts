import * as mongoose from 'mongoose';
import { battleSchema } from '../models/battleModels';
import { Request, Response } from 'express';
import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import config from '../config/config';

const battles = mongoose.model('battles', battleSchema);

export class battleController {
    public VerifyToken(req, res, next) {
        var token = req.headers['x-access-token'];
        if (!token)
            return res.status(403).send({ auth: false, message: 'No token provided.' });
        jwt.verify(token, config.SECRET, function (err, decoded) {
            if (err)
                return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
            next();
        });
    }

    LoginBattlesAPI(req: Request, res: Response) {
        let passwordIsValid = bcrypt.compareSync(req.body.password, config.PASSWORD);
        if (!passwordIsValid || req.body.username !== config.USERNAME) return res.status(401).send({ auth: false, token: null });

        let hashedPassword = bcrypt.hashSync(req.body.password, 8)
        let token = jwt.sign({ id: config.USERNAME }, config.SECRET, {
            expiresIn: 86400 // expires in 24 hours
        });

        res.status(200).send({ auth: true, token: token });

    }

    BattleSearch(req: Request, res: Response) {
        let query = {};

        let king = req.query.king;
        if (king) {
            let kingsQuery = {
                $or: [{ attacker_king: king },
                { defender_king: king }
                ]
            };
            query = { ...query, ...kingsQuery };
        }

        let type = req.query.type;
        if (type) {
            let typeQuery = {
                battle_type: type
            };
            query = { $and: [query, typeQuery] };
        }

        let location = req.query.location;
        if (location) {
            let locationQuery = {
                $or: [{ region: location },
                { location: location }
                ]
            };
            query = { $and: [query, locationQuery] };
        }

        let attacker = req.query.attacker;
        if (attacker) {
            let attackerQuery = {
                $or: [{ attacker_1: attacker },
                { attacker_2: attacker },
                { attacker_3: attacker },
                { attacker_4: attacker }]
            };
            query = { $and: [query, attackerQuery] };
        }

        let defender = req.query.attacker;
        if (defender) {
            let defenderQuery = {
                $or: [{ defender_1: attacker },
                { defender_2: attacker },
                { defender_3: attacker },
                { defender_4: attacker }]
            };
            query = { $and: [query, defenderQuery] };
        }

        battles.find(query, (err, allBattles) => {
            if (err) {
                res.status(500).send("error");
            }
            res.status(200).json(allBattles);
        });
    }

    GetBattleStats(req: Request, res: Response) {
        battles.aggregate([
            {
                $facet: {
                    q: [
                        { $match: { attacker_king: { $exists: true, $nin: ["", null] } } },
                        { $count: "total" },
                        { $sort: { "battle_number": 1 } }
                    ],
                    q0: [
                        { $match: { defender_king: { $exists: true, $nin: ["", null] } } },
                        { $count: "total" },
                        { $sort: { "battle_number": 1 } }
                    ],
                    q1: [
                        { $match: { region: { $exists: true, $nin: ["", null] } } },
                        { $count: "total" },
                        { $sort: { "battle_number": 1 } }
                    ],
                    q2: [
                        { $match: { name: { $exists: true, $nin: ["", null] } } },
                        { $count: "total" },
                        { $sort: { "battle_number": 1 } }
                    ],
                    q3: [
                        { $match: { attacker_outcome: 'win' } },
                        { $count: "total" }
                    ],
                    q4: [
                        { $match: { attacker_outcome: 'loss' } },
                        { $count: "total" }
                    ],
                    q5: [
                        {
                            $group: {
                                _id: null,
                                unique: { $addToSet: "$battle_type" }
                            }
                        }
                    ],
                    q6: [
                        {
                            $group: {
                                _id: null,
                                average: { $avg: "$defender_size" },
                                min: { $min: "$defender_size" },
                                max: { $max: "$defender_size" },
                            }
                        }
                    ],
                }
            },
            {
                $project: {
                    q: { $arrayElemAt: ["$q", 0] },
                    q0: { $arrayElemAt: ["$q0", 0] },
                    q1: { $arrayElemAt: ["$q1", 0] },
                    q2: { $arrayElemAt: ["$q2", 0] },
                    q3: { $arrayElemAt: ["$q3", 0] },
                    q4: { $arrayElemAt: ["$q4", 0] },
                    q5: { $arrayElemAt: ["$q5", 0] },
                    q6: { $arrayElemAt: ["$q6", 0] }
                }
            },
            {
                $project: {
                    "most_active.attacker_king": { $ifNull: ["$q1.total", 0] },
                    "most_active.defender_king": { $ifNull: ["$q2.total", 0] },
                    "most_active.region": { $ifNull: ["$q1.total", 0] },
                    "most_active.name": { $ifNull: ["$q2.total", 0] },
                    "attacker_outcome.win": { $ifNull: ["$q3.total", 0] },
                    "attacker_outcome.loss": { $ifNull: ["$q4.total", 0] },
                    "battle_type": "$q5.unique",
                    "defender_size.average": "$q6.average",
                    "defender_size.min": "$q6.min",
                    "defender_size.max": "$q6.max",
                }
            }
        ])
            .exec((err, battles) => {
                if (err) {
                    res.status(500).send("error");
                }
                res.status(200).json(battles);
            });
    }

    CountAllBattles(req: Request, res: Response) {
        battles.count({}, (err, count) => {
            if (err) {
                res.status(500).send("error");
            }
            res.status(200).json(count);
        });
    }

    public ListAllBattles(req: Request, res: Response) {
        battles.find({}, (err, allBattles) => {
            if (err) {
                res.status(500).send("error");
            }
            res.status(200).json(allBattles);
        });
    }
}
