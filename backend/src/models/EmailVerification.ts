export interface IEmailVerification {
  email: string;
  code: string;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
}

export const EmailVerification = {
  async create(doc: Partial<IEmailVerification>) {
    return Promise.resolve({ ...doc, _id: '1' } as any);
  },

  async findOne(query: any) {
    return Promise.resolve(null);
  },

  async find(query: any = {}) {
    return Promise.resolve([]);
  },

  async deleteMany(query: any = {}) {
    return Promise.resolve({ deletedCount: 0 });
  },

  async findOneAndUpdate(query: any, update: any, opts: any = {}) {
    return Promise.resolve(null);
  },
};



