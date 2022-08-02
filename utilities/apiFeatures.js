class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
      // query.sort('price ratingAverage');
    } else {
      this.query = this.query.sort('-name');
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');

      this.query = this.query.select(fields);
      // project only some fields
      // query.select('name duration price');
    } else {
      // Excluding specific fields

      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    // page=2&limit=10, 1-10, page 1,
    //  11-20, page 2,
    //  21-30 page 3

    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skipTo = (page - 1) * limit;

    this.query = this.query.skip(skipTo).limit(limit);

    return this;
  }
}
module.exports = APIFeatures;
