import { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  TextField,
  Button,
  Grid,
  Paper,
  Typography,
  MenuItem,
  IconButton,
  Box,
  FormControl,
  InputLabel,
  Select,
  Container,
  Card,
  CardContent,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { products, states } from '../data/mockData';

// Validation schemas
const productSchema = z.object({
  productName: z.string().min(1, 'Product name is required'),
  hsnCode: z.string().min(1, 'HSN code is required'),
  qty: z.coerce.number().min(1, 'Quantity must be at least 1'),
  salePrice: z.coerce.number().min(0, 'Sale price must be positive'),
  discount: z.coerce.number().min(0, 'Discount must be positive').default(0),
  taxableValue: z.number().optional(),
  cgst: z.number().optional(),
  sgst: z.number().optional(),
  totalValue: z.number().optional(),
});

const invoiceSchema = z.object({
  invoiceNo: z.string().min(1, 'Invoice number is required'),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  customer: z.object({
    name: z.string().min(1, 'Customer name is required'),
    address: z.string().min(1, 'Customer address is required'),
    state: z.string().min(1, 'State is required'),
    gstin: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val),
        'Invalid GSTIN format'
      ),
  }),
  products: z.array(productSchema).min(1, 'At least one product is required'),
  paymentMethod: z.enum(['Cash', 'Online Transfer', 'On Credit']),
  transactionId: z.string().optional(),
  narration: z.string().optional(),
}).refine(
  (data) => data.paymentMethod !== 'Online Transfer' || !!data.transactionId,
  { message: 'Transaction ID is required for Online Transfer', path: ['transactionId'] }
);

const InvoiceForm = () => {
  const [showPayload, setShowPayload] = useState(false);
  const [formData, setFormData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoiceNo: '',
      invoiceDate: '',
      customer: { name: '', address: '', state: '', gstin: '' },
      products: [{ productName: '', hsnCode: '', qty: 1, salePrice: 0, discount: 0 }],
      paymentMethod: 'Cash',
      narration: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'products',
  });

  const watchProducts = watch('products');
  const watchPaymentMethod = watch('paymentMethod');

  const calculateProductValues = (product) => {
    const qty = Number(product.qty) || 0;
    const salePrice = Number(product.salePrice) || 0;
    const discount = Number(product.discount) || 0;
    const taxableValue = qty * salePrice - discount;
    const cgst = taxableValue * 0.09; // 9% CGST
    const sgst = taxableValue * 0.09; // 9% SGST
    const totalValue = taxableValue + cgst + sgst;

    return {
      taxableValue,
      cgst,
      sgst,
      totalValue,
    };
  };

  // Update product values whenever they change
  useEffect(() => {
    watchProducts.forEach((product, index) => {
      if (product.productName) {
        const values = calculateProductValues(product);
        setValue(`products.${index}.taxableValue`, values.taxableValue);
        setValue(`products.${index}.cgst`, values.cgst);
        setValue(`products.${index}.sgst`, values.sgst);
        setValue(`products.${index}.totalValue`, values.totalValue);
      }
    });
  }, [watchProducts, setValue]);

  const calculateTotals = () => {
    return watchProducts.reduce(
      (acc, product) => {
        const values = calculateProductValues(product);
        return {
          totalTaxableValue: acc.totalTaxableValue + values.taxableValue,
          totalCGST: acc.totalCGST + values.cgst,
          totalSGST: acc.totalSGST + values.sgst,
          totalValue: acc.totalValue + values.totalValue,
        };
      },
      { totalTaxableValue: 0, totalCGST: 0, totalSGST: 0, totalValue: 0 }
    );
  };

  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true);
      const processedData = {
        invoiceNo: data.invoiceNo,
        invoiceDate: data.invoiceDate,
        customer: {
          name: data.customer.name,
          address: data.customer.address,
          state: data.customer.state,
          gstin: data.customer.gstin || undefined,
        },
        products: data.products.map((product) => {
          const values = calculateProductValues(product);
          return {
            productName: product.productName,
            hsnCode: product.hsnCode,
            qty: product.qty,
            salePrice: product.salePrice,
            discount: product.discount,
            taxableValue: values.taxableValue,
            gst: {
              cgst: values.cgst,
              sgst: values.sgst,
            },
            totalValue: values.totalValue,
          };
        }),
        totalInvoiceValue: calculateTotals().totalValue,
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId || undefined,
        narration: data.narration || undefined,
      };
      setFormData(processedData);
      setShowPayload(true);
      console.log('Form Data:', processedData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totals = calculateTotals();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          borderRadius: 2,
          backgroundColor: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            color: '#1a237e',
            fontWeight: 600,
            mb: 4,
            textAlign: 'center',
          }}
        >
          Create New Invoice
        </Typography>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={4}>
            {/* Invoice Details */}
            <Grid item xs={12}>
              <Card elevation={0} sx={{ backgroundColor: '#f5f5f5', mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#1a237e', mb: 2 }}>
                    Invoice Details
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Invoice Number"
                        {...register('invoiceNo')}
                        error={!!errors.invoiceNo}
                        helperText={errors.invoiceNo?.message}
                        variant="outlined"
                        sx={{ backgroundColor: '#ffffff' }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="date"
                        label="Invoice Date"
                        InputLabelProps={{ shrink: true }}
                        {...register('invoiceDate')}
                        error={!!errors.invoiceDate}
                        helperText={errors.invoiceDate?.message}
                        variant="outlined"
                        sx={{ backgroundColor: '#ffffff' }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Customer Details */}
            <Grid item xs={12}>
              <Card elevation={0} sx={{ backgroundColor: '#f5f5f5', mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#1a237e', mb: 2 }}>
                    Customer Details
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Customer Name"
                        {...register('customer.name')}
                        error={!!errors.customer?.name}
                        helperText={errors.customer?.name?.message}
                        variant="outlined"
                        sx={{ backgroundColor: '#ffffff' }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Customer Address"
                        {...register('customer.address')}
                        error={!!errors.customer?.address}
                        helperText={errors.customer?.address?.message}
                        variant="outlined"
                        sx={{ backgroundColor: '#ffffff' }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="customer.state"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth error={!!errors.customer?.state}>
                            <InputLabel>State</InputLabel>
                            <Select
                              {...field}
                              label="State"
                              sx={{ backgroundColor: '#ffffff' }}
                            >
                              <MenuItem value="">
                                <em>Select State</em>
                              </MenuItem>
                              {states.map((state) => (
                                <MenuItem key={state} value={state}>
                                  {state}
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.customer?.state && (
                              <Typography color="error" variant="caption">
                                {errors.customer.state.message}
                              </Typography>
                            )}
                          </FormControl>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="GSTIN (Optional)"
                        {...register('customer.gstin')}
                        error={!!errors.customer?.gstin}
                        helperText={errors.customer?.gstin?.message}
                        variant="outlined"
                        sx={{ backgroundColor: '#ffffff' }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Products */}
            <Grid item xs={12}>
              <Card elevation={0} sx={{ backgroundColor: '#f5f5f5', mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#1a237e', mb: 2 }}>
                    Products
                  </Typography>
                  {fields.map((field, index) => (
                    <Paper
                      key={field.id}
                      elevation={1}
                      sx={{
                        p: 2,
                        mb: 2,
                        backgroundColor: '#ffffff',
                        '&:hover': {
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        },
                      }}
                    >
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={3}>
                          <Controller
                            name={`products.${index}.productName`}
                            control={control}
                            render={({ field }) => (
                              <FormControl
                                fullWidth
                                error={!!errors.products?.[index]?.productName}
                              >
                                <InputLabel>Product</InputLabel>
                                <Select
                                  {...field}
                                  label="Product"
                                  onChange={(e) => {
                                    field.onChange(e);
                                    const selectedProduct = products.find(
                                      (p) => p.name === e.target.value
                                    );
                                    if (selectedProduct) {
                                      setValue(
                                        `products.${index}.hsnCode`,
                                        selectedProduct.hsnCode
                                      );
                                      setValue(
                                        `products.${index}.salePrice`,
                                        selectedProduct.salePrice || 0
                                      );
                                    }
                                  }}
                                  sx={{ backgroundColor: '#ffffff' }}
                                >
                                  <MenuItem value="">
                                    <em>Select Product</em>
                                  </MenuItem>
                                  {products.map((product) => (
                                    <MenuItem key={product.id} value={product.name}>
                                      {product.name}
                                    </MenuItem>
                                  ))}
                                </Select>
                                {errors.products?.[index]?.productName && (
                                  <Typography color="error" variant="caption">
                                    {errors.products[index].productName.message}
                                  </Typography>
                                )}
                              </FormControl>
                            )}
                          />
                        </Grid>
                        <Grid item xs={12} md={2}>
                          <TextField
                            fullWidth
                            label="HSN Code"
                            {...register(`products.${index}.hsnCode`)}
                            disabled
                            variant="outlined"
                            sx={{ backgroundColor: '#f5f5f5' }}
                            InputLabelProps={{ shrink: Boolean(watchProducts[index]?.hsnCode) }}
                            value={watchProducts[index]?.hsnCode || ''}
                          />
                        </Grid>
                        <Grid item xs={12} md={1}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Qty"
                            {...register(`products.${index}.qty`, {
                              valueAsNumber: true,
                            })}
                            error={!!errors.products?.[index]?.qty}
                            helperText={errors.products?.[index]?.qty?.message}
                            variant="outlined"
                            sx={{ backgroundColor: '#ffffff' }}
                          />
                        </Grid>
                        <Grid item xs={12} md={2}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Sale Price"
                            {...register(`products.${index}.salePrice`, {
                              valueAsNumber: true,
                            })}
                            error={!!errors.products?.[index]?.salePrice}
                            helperText={errors.products?.[index]?.salePrice?.message}
                            variant="outlined"
                            sx={{ backgroundColor: '#ffffff' }}
                          />
                        </Grid>
                        <Grid item xs={12} md={2}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Discount"
                            {...register(`products.${index}.discount`, {
                              valueAsNumber: true,
                            })}
                            error={!!errors.products?.[index]?.discount}
                            helperText={errors.products?.[index]?.discount?.message}
                            variant="outlined"
                            sx={{ backgroundColor: '#ffffff' }}
                          />
                        </Grid>
                        <Grid item xs={12} md={1}>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="subtitle2" color="primary">
                              ₹{calculateProductValues(watchProducts[index]).totalValue.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary">
                              Tax: ₹{calculateProductValues(watchProducts[index]).taxableValue.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary">
                              CGST: ₹{calculateProductValues(watchProducts[index]).cgst.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary">
                              SGST: ₹{calculateProductValues(watchProducts[index]).sgst.toFixed(2)}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={1}>
                          <IconButton
                            color="error"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                            sx={{
                              '&:hover': {
                                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                              },
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() =>
                      append({
                        productName: '',
                        hsnCode: '',
                        qty: 1,
                        salePrice: 0,
                        discount: 0,
                      })
                    }
                    variant="outlined"
                    color="primary"
                    sx={{ mt: 2 }}
                  >
                    Add Product
                  </Button>
                  {errors.products && (
                    <Typography color="error" variant="caption">
                      {errors.products.message}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Invoice Summary */}
            <Grid item xs={12}>
              <Card elevation={0} sx={{ backgroundColor: '#f5f5f5', mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#1a237e', mb: 2 }}>
                    Invoice Summary
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={3}>
                      <Typography variant="subtitle1" color="text.secondary">
                        Total Taxable Value
                      </Typography>
                      <Typography variant="h6" color="primary">
                        ₹{totals.totalTaxableValue.toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="subtitle1" color="text.secondary">
                        Total CGST (9%)
                      </Typography>
                      <Typography variant="h6" color="primary">
                        ₹{totals.totalCGST.toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="subtitle1" color="text.secondary">
                        Total SGST (9%)
                      </Typography>
                      <Typography variant="h6" color="primary">
                        ₹{totals.totalSGST.toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="subtitle1" color="text.secondary">
                        Total Amount
                      </Typography>
                      <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
                        ₹{totals.totalValue.toFixed(2)}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Payment Details */}
            <Grid item xs={12}>
              <Card elevation={0} sx={{ backgroundColor: '#f5f5f5', mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#1a237e', mb: 2 }}>
                    Payment Details
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="paymentMethod"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth error={!!errors.paymentMethod}>
                            <InputLabel>Payment Method</InputLabel>
                            <Select
                              {...field}
                              label="Payment Method"
                              sx={{ backgroundColor: '#ffffff' }}
                            >
                              <MenuItem value="Cash">Cash</MenuItem>
                              <MenuItem value="Online Transfer">Online Transfer</MenuItem>
                              <MenuItem value="On Credit">On Credit</MenuItem>
                            </Select>
                            {errors.paymentMethod && (
                              <Typography color="error" variant="caption">
                                {errors.paymentMethod.message}
                              </Typography>
                            )}
                          </FormControl>
                        )}
                      />
                    </Grid>
                    {watchPaymentMethod === 'Online Transfer' && (
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Transaction ID"
                          {...register('transactionId')}
                          error={!!errors.transactionId}
                          helperText={errors.transactionId?.message}
                          variant="outlined"
                          sx={{ backgroundColor: '#ffffff' }}
                        />
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Narration */}
            <Grid item xs={12}>
              <Card elevation={0} sx={{ backgroundColor: '#f5f5f5', mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#1a237e', mb: 2 }}>
                    Additional Notes
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Narration"
                    {...register('narration')}
                    error={!!errors.narration}
                    helperText={errors.narration?.message}
                    variant="outlined"
                    sx={{ backgroundColor: '#ffffff' }}
                  />
                </CardContent>
              </Card>
            </Grid>

            {/* Submit Button */}
            <Grid item xs={12} sx={{ textAlign: 'center' }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={isSubmitting}
                sx={{
                  px: 6,
                  py: 1.5,
                  fontSize: '1.1rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                  '&:hover': {
                    boxShadow: '0 6px 16px rgba(25, 118, 210, 0.4)',
                  },
                }}
              >
                {isSubmitting ? 'Generating...' : 'Generate Invoice'}
              </Button>
            </Grid>
          </Grid>
        </form>

        {/* Display Payload */}
        {showPayload && formData && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" sx={{ color: '#1a237e', mb: 2 }}>
              Generated Payload
            </Typography>
            <Paper
              sx={{
                p: 2,
                backgroundColor: '#f8f9fa',
                borderRadius: 1,
              }}
            >
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(formData, null, 2)}
              </pre>
            </Paper>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default InvoiceForm;